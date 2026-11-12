-- Ride-share fulfilment. Retain historical assignments but require no rider for new dispatches.
-- Run once in the Kinga Supabase SQL Editor. Existing orders and audit history are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.kinga_mutate(action text,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; o public.orders%ROWTYPE;b public.batches%ROWTYPE;pr public.purchases%ROWTYPE;l jsonb;r record;lot record;alloc record;qty numeric;take_qty integer;remaining integer;subtotal numeric;fee numeric;disc numeric;newstatus text;phone_value text;customer uuid;claimed_role text:=public.kinga_role();
BEGIN
 IF action IN ('save_order','transition_order') THEN PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);
 ELSIF action IN ('save_batch','post_batch','save_material','hold_lot','adjust_stock') THEN PERFORM public.kinga_require(ARRAY['admin','stock_keeper']);
 ELSIF action IN ('save_purchase','post_purchase') THEN PERFORM public.kinga_require(ARRAY['admin','stock_keeper','cashier']);
 ELSIF action='record_payment' THEN PERFORM public.kinga_require(ARRAY['admin','cashier']);
 ELSIF action='save_customer' THEN PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);
 ELSIF action='update_delivery' THEN PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);
 ELSIF action IN ('save_review','save_product','save_bundle') THEN PERFORM public.kinga_require(ARRAY['admin']);
 ELSE RAISE EXCEPTION 'Unknown operation';END IF;
 -- One inventory lock serializes reservations, receipts, production and corrections.
 PERFORM pg_advisory_xact_lock(77441126);
 IF action='save_order' THEN
  IF claimed_role='driver' THEN RAISE EXCEPTION 'Drivers cannot create orders';END IF;
  subtotal:=public.kinga_validate_lines(p_data->'lines');fee:=coalesce((p_data->>'delivery_fee')::numeric,0);disc:=coalesce((p_data->>'discount')::numeric,0);
  IF fee<0 OR disc<0 OR disc>subtotal THEN RAISE EXCEPTION 'Invalid delivery fee or discount';END IF;
  IF nullif(p_data->>'idempotency_key','') IS NOT NULL THEN SELECT id INTO rid FROM public.orders WHERE idempotency_key=(p_data->>'idempotency_key')::uuid AND created_by=auth.uid();IF FOUND THEN RETURN rid;END IF;END IF;
  phone_value:=public.kinga_phone(p_data->>'phone');
  IF length(trim(coalesce(p_data->>'customer_name','')))<2 OR length(trim(coalesce(p_data->>'location','')))<2 THEN RAISE EXCEPTION 'Customer name and delivery location are required';END IF;
  INSERT INTO public.customers(name,phone,location) VALUES(trim(p_data->>'customer_name'),phone_value,p_data->>'location') ON CONFLICT(phone) DO NOTHING;
  SELECT id INTO customer FROM public.customers WHERE phone=phone_value;
  INSERT INTO public.orders(customer_id,customer_name,phone,location,notes,lines,total,delivery_fee,discount,delivery_date,source,created_by,idempotency_key)
  VALUES(customer,p_data->>'customer_name',phone_value,p_data->>'location',coalesce(p_data->>'notes',''),p_data->'lines',subtotal+fee-disc,fee,disc,(p_data->>'delivery_date')::date,'staff',auth.uid(),(p_data->>'idempotency_key')::uuid) RETURNING id INTO rid;
 ELSIF action='transition_order' THEN
  SELECT * INTO STRICT o FROM public.orders WHERE id=(p_data->>'id')::uuid FOR UPDATE;rid:=o.id;newstatus:=p_data->>'status';
  IF claimed_role='driver' AND (o.rider_id IS DISTINCT FROM auth.uid() OR newstatus NOT IN ('dispatched','delivered')) THEN RAISE EXCEPTION 'Drivers can only update assigned deliveries';END IF;
  IF o.status=newstatus THEN RETURN rid;END IF;
  IF NOT (o.status='requested' AND newstatus IN ('confirmed','cancelled') OR o.status='confirmed' AND newstatus IN ('packed','cancelled') OR o.status='packed' AND newstatus IN ('dispatched','cancelled') OR o.status='dispatched' AND newstatus='delivered') THEN RAISE EXCEPTION 'Invalid order transition';END IF;
  IF newstatus='confirmed' THEN
   INSERT INTO public.customers(name,phone,location) VALUES(o.customer_name,o.phone,o.location) ON CONFLICT(phone) DO NOTHING;
   UPDATE public.orders SET customer_id=(SELECT id FROM public.customers WHERE phone=o.phone) WHERE id=o.id;
   FOR r IN SELECT (value->>'product_id')::uuid AS product_id,sum((value->>'quantity')::integer)::integer AS quantity FROM jsonb_array_elements(o.lines) GROUP BY 1 ORDER BY 1 LOOP
    remaining:=r.quantity;
    FOR lot IN SELECT * FROM public.stock_lots WHERE product_id=r.product_id AND NOT held AND use_by>=public.kinga_today() AND quantity>reserved ORDER BY use_by,id FOR UPDATE LOOP
     take_qty:=least(remaining,lot.quantity-lot.reserved);UPDATE public.stock_lots SET reserved=reserved+take_qty WHERE id=lot.id;
     INSERT INTO public.allocations(order_id,lot_id,quantity) VALUES(o.id,lot.id,take_qty);
     INSERT INTO public.movements(item,product_id,lot_id,quantity,reason,reference,actor) VALUES('Bottles reserved',r.product_id,lot.id,-take_qty,'reservation',o.reference,auth.uid());
     remaining:=remaining-take_qty;EXIT WHEN remaining=0;
    END LOOP;
    IF remaining>0 THEN RAISE EXCEPTION 'Insufficient approved stock. Check held and expired lots.';END IF;
   END LOOP;
  ELSIF newstatus='cancelled' THEN
   IF o.paid>0 THEN RAISE EXCEPTION 'Paid orders require a documented refund process; cancellation is blocked';END IF;
   FOR alloc IN SELECT * FROM public.allocations WHERE order_id=o.id AND state='reserved' FOR UPDATE LOOP
    UPDATE public.stock_lots SET reserved=reserved-alloc.quantity WHERE id=alloc.lot_id;
    UPDATE public.allocations SET state='released' WHERE id=alloc.id;
    INSERT INTO public.movements(item,lot_id,quantity,reason,reference,actor) VALUES('Reservation released',alloc.lot_id,alloc.quantity,'cancellation',o.reference,auth.uid());
   END LOOP;
  ELSIF newstatus='dispatched' THEN
   IF o.paid<o.total THEN RAISE EXCEPTION 'Settle the outstanding balance before dispatch';END IF;
   IF EXISTS(SELECT 1 FROM public.allocations a JOIN public.stock_lots l ON l.id=a.lot_id WHERE a.order_id=o.id AND a.state='reserved' AND (l.held OR l.use_by<public.kinga_today())) THEN RAISE EXCEPTION 'Reserved lot is held or expired. Resolve before dispatch';END IF;
   FOR alloc IN SELECT * FROM public.allocations WHERE order_id=o.id AND state='reserved' FOR UPDATE LOOP
    UPDATE public.stock_lots SET quantity=quantity-alloc.quantity,reserved=reserved-alloc.quantity WHERE id=alloc.lot_id;
    UPDATE public.allocations SET state='consumed' WHERE id=alloc.id;
    INSERT INTO public.movements(item,lot_id,quantity,reason,reference,actor) VALUES('Bottles dispatched',alloc.lot_id,-alloc.quantity,'dispatch',o.reference,auth.uid());
   END LOOP;
  END IF;
  UPDATE public.orders SET status=newstatus,confirmed_at=CASE WHEN newstatus='confirmed' THEN now() ELSE confirmed_at END WHERE id=o.id;
 ELSIF action='record_payment' THEN
  SELECT * INTO STRICT o FROM public.orders WHERE id=(p_data->>'order_id')::uuid FOR UPDATE;rid:=o.id;qty:=(p_data->>'amount')::numeric;
  IF o.status IN ('requested','cancelled') OR qty IS NULL OR qty<=0 OR qty>o.total-o.paid OR length(trim(coalesce(p_data->>'reference','')))<2 THEN RAISE EXCEPTION 'Enter a valid payment within the confirmed outstanding balance and a unique reference';END IF;
  INSERT INTO public.payments(order_id,amount,method,reference,created_by) VALUES(o.id,qty,p_data->>'method',trim(p_data->>'reference'),auth.uid());UPDATE public.orders SET paid=paid+qty WHERE id=o.id;
 ELSIF action='save_batch' THEN
  IF jsonb_typeof(p_data->'outputs')!='array' OR jsonb_array_length(p_data->'outputs')<1 OR jsonb_typeof(p_data->'inputs')!='array' OR jsonb_array_length(p_data->'inputs')<1 THEN RAISE EXCEPTION 'Record all material inputs and bottled outputs';END IF;
  IF (p_data->>'production_date')::date>public.kinga_today() THEN RAISE EXCEPTION 'Production date cannot be in the future';END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_data->'outputs') LOOP qty:=(l->>'quantity')::numeric;IF qty IS NULL OR qty<=0 OR qty!=trunc(qty) OR NOT EXISTS(SELECT 1 FROM public.products WHERE id=(l->>'product_id')::uuid AND blend=p_data->>'blend') THEN RAISE EXCEPTION 'Output must use whole bottles of the selected blend';END IF;END LOOP;
  FOR l IN SELECT * FROM jsonb_array_elements(p_data->'inputs') LOOP IF coalesce((l->>'quantity')::numeric,0)<=0 OR NOT EXISTS(SELECT 1 FROM public.materials WHERE id=(l->>'material_id')::uuid) THEN RAISE EXCEPTION 'Invalid material input';END IF;END LOOP;
  INSERT INTO public.batches(reference,blend,production_date,use_by,outputs,inputs,wastage,notes,created_by) VALUES(p_data->>'reference',p_data->>'blend',(p_data->>'production_date')::date,(p_data->>'use_by')::date,p_data->'outputs',p_data->'inputs',coalesce((p_data->>'wastage')::integer,0),coalesce(p_data->>'notes',''),auth.uid()) RETURNING id INTO rid;
 ELSIF action='post_batch' THEN
  SELECT * INTO STRICT b FROM public.batches WHERE id=(p_data->>'id')::uuid FOR UPDATE;rid:=b.id;IF b.status='posted' THEN RETURN rid;END IF;
  IF b.use_by<public.kinga_today() THEN RAISE EXCEPTION 'The approved use-by date has passed';END IF;
  FOR r IN SELECT (value->>'material_id')::uuid AS material_id,sum((value->>'quantity')::numeric) AS quantity FROM jsonb_array_elements(b.inputs) GROUP BY 1 ORDER BY 1 LOOP
   UPDATE public.materials SET quantity=quantity-r.quantity WHERE id=r.material_id AND quantity>=r.quantity;
   IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient materials. No production was posted';END IF;
   INSERT INTO public.movements(item,material_id,quantity,reason,reference,actor) SELECT name,id,-r.quantity,'production input',b.reference,auth.uid() FROM public.materials WHERE id=r.material_id;
  END LOOP;
  FOR r IN SELECT (value->>'product_id')::uuid AS product_id,sum((value->>'quantity')::integer)::integer AS quantity FROM jsonb_array_elements(b.outputs) GROUP BY 1 LOOP
   INSERT INTO public.stock_lots(product_id,batch_id,batch_reference,quantity,use_by) VALUES(r.product_id,b.id,b.reference,r.quantity,b.use_by) RETURNING id INTO customer;
   INSERT INTO public.movements(item,product_id,lot_id,quantity,reason,reference,actor) VALUES('Finished bottles',r.product_id,customer,r.quantity,'production output',b.reference,auth.uid());
  END LOOP;
  UPDATE public.batches SET status='posted',verified_by=auth.uid(),verified_at=now() WHERE id=b.id;
 ELSIF action='save_purchase' THEN
  IF p_data->>'kind'='expense' AND claimed_role='stock_keeper' THEN RAISE EXCEPTION 'Only owner and cashier may record operating expenses';END IF;
  IF p_data->>'kind'='purchase' AND (jsonb_typeof(p_data->'lines')!='array' OR jsonb_array_length(p_data->'lines')<1) THEN RAISE EXCEPTION 'Record material quantities received';END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(coalesce(p_data->'lines','[]')) LOOP IF coalesce((l->>'quantity')::numeric,0)<=0 OR NOT EXISTS(SELECT 1 FROM public.materials WHERE id=(l->>'material_id')::uuid) THEN RAISE EXCEPTION 'Invalid receipt material or quantity';END IF;END LOOP;
  INSERT INTO public.purchases(reference,supplier,description,date,kind,amount,lines,created_by) VALUES(p_data->>'reference',p_data->>'supplier',p_data->>'description',(p_data->>'date')::date,p_data->>'kind',(p_data->>'amount')::numeric,coalesce(p_data->'lines','[]'),auth.uid()) RETURNING id INTO rid;
 ELSIF action='post_purchase' THEN
  SELECT * INTO STRICT pr FROM public.purchases WHERE id=(p_data->>'id')::uuid FOR UPDATE;rid:=pr.id;IF pr.status='posted' THEN RETURN rid;END IF;
  IF pr.kind='expense' AND claimed_role='stock_keeper' THEN RAISE EXCEPTION 'Expense verification requires owner or cashier';END IF;
  IF pr.kind='purchase' THEN FOR l IN SELECT * FROM jsonb_array_elements(pr.lines) LOOP qty:=(l->>'quantity')::numeric;UPDATE public.materials SET quantity=quantity+qty WHERE id=(l->>'material_id')::uuid;INSERT INTO public.movements(item,material_id,quantity,reason,reference,actor) SELECT name,id,qty,'purchase receipt',pr.reference,auth.uid() FROM public.materials WHERE id=(l->>'material_id')::uuid;END LOOP;END IF;
  UPDATE public.purchases SET status='posted',verified_by=auth.uid(),verified_at=now() WHERE id=pr.id;
 ELSIF action='save_customer' THEN
  phone_value:=public.kinga_phone(p_data->>'phone');INSERT INTO public.customers(name,phone,location,notes,marketing_opt_out) VALUES(p_data->>'name',phone_value,coalesce(p_data->>'location',''),coalesce(p_data->>'notes',''),coalesce((p_data->>'marketing_opt_out')::boolean,true)) RETURNING id INTO rid;
 ELSIF action='save_material' THEN
  INSERT INTO public.materials(name,kind,unit,threshold) VALUES(p_data->>'name',p_data->>'kind',p_data->>'unit',coalesce((p_data->>'threshold')::numeric,0)) RETURNING id INTO rid;
 ELSIF action='save_product' THEN
  UPDATE public.products SET price=(p_data->>'price')::numeric,price_confirmed=coalesce((p_data->>'price_confirmed')::boolean,false) WHERE id=(p_data->>'id')::uuid RETURNING id INTO rid;
 ELSIF action='save_bundle' THEN
  INSERT INTO public.bundles(name,product_id,quantity,free_quantity,price,active) VALUES(p_data->>'name',(p_data->>'product_id')::uuid,(p_data->>'quantity')::integer,coalesce((p_data->>'free_quantity')::integer,0),(p_data->>'price')::numeric,coalesce((p_data->>'active')::boolean,false)) RETURNING id INTO rid;
 ELSIF action='update_delivery' THEN
  SELECT * INTO STRICT o FROM public.orders WHERE id=(p_data->>'id')::uuid FOR UPDATE;rid:=o.id;
  IF o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled orders cannot change delivery details';END IF;
  fee:=coalesce((p_data->>'delivery_fee')::numeric,o.delivery_fee);
  IF fee<0 OR fee>100000 OR fee::text='NaN' THEN RAISE EXCEPTION 'Enter a valid delivery fee';END IF;
  subtotal:=o.total-o.delivery_fee+fee;
  IF subtotal<o.paid THEN RAISE EXCEPTION 'Delivery fee change would reduce the total below payments received';END IF;
  IF o.status='dispatched' AND subtotal>o.paid THEN RAISE EXCEPTION 'An order with the ride-share must remain fully paid';END IF;
  IF nullif(p_data->>'delivery_date','') IS NULL THEN RAISE EXCEPTION 'Delivery date is required';END IF;
  UPDATE public.orders SET delivery_date=(p_data->>'delivery_date')::date,delivery_fee=fee,total=subtotal,rider_id=NULL,exception_reason=coalesce(p_data->>'exception_reason','') WHERE id=o.id;
 ELSIF action='hold_lot' THEN
  rid:=(p_data->>'id')::uuid;IF length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'A stock control reason is required';END IF;UPDATE public.stock_lots SET held=(p_data->>'held')::boolean WHERE id=rid;
 ELSIF action='adjust_stock' THEN
  rid:=(p_data->>'id')::uuid;qty:=(p_data->>'quantity')::numeric;IF qty IS NULL OR qty=0 OR qty!=trunc(qty) OR length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Enter whole bottles and a correction reason';END IF;
  UPDATE public.stock_lots SET quantity=quantity+qty WHERE id=rid AND quantity+qty>=reserved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction would remove reserved stock';END IF;
  INSERT INTO public.movements(item,lot_id,quantity,reason,reference,actor) SELECT 'Stock correction',id,qty,p_data->>'reason',batch_reference,auth.uid() FROM public.stock_lots WHERE id=rid;
 ELSIF action='save_review' THEN
  IF NOT (p_data->'checks' @> '["Missing records checked","Stock and use-by alerts reviewed","Outstanding payments followed up","Wastage reviewed","Delivery exceptions resolved"]'::jsonb) THEN RAISE EXCEPTION 'Complete every weekly review check';END IF;
  INSERT INTO public.reviews("from","to",checks,reviewer,reviewer_id) SELECT (p_data->>'from')::date,(p_data->>'to')::date,p_data->'checks',full_name,id FROM public.profiles WHERE id=auth.uid() RETURNING id INTO rid;
 END IF;
 IF rid IS NULL THEN RAISE EXCEPTION 'Record not found';END IF;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES(action,rid,auth.uid(),p_data);
 RETURN rid;
END $$;
-- Keep old driver identities for history; they no longer receive order access.
DROP POLICY IF EXISTS read_orders ON public.orders;
CREATE POLICY read_orders ON public.orders FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','sales','cashier'));
REVOKE ALL ON FUNCTION public.kinga_mutate(text,jsonb) FROM PUBLIC,anon,authenticated;
COMMIT;
