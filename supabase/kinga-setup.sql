-- Kinga Asili clean-project setup. Run in Supabase SQL Editor.
-- This file refuses to overwrite an existing products table.

-- CLEAN KINGA PROJECT ONLY. Do not apply over the migrations from another system.
BEGIN;
DO $$ BEGIN IF to_regclass('public.products') IS NOT NULL THEN RAISE EXCEPTION 'Use a clean Supabase project. Existing product records detected.'; END IF; END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text NOT NULL,role text NOT NULL CHECK(role IN ('admin','sales','cashier','stock_keeper','driver')));
CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,blend text NOT NULL CHECK(blend IN ('GLT','GOT')),volume_ml integer NOT NULL CHECK(volume_ml IN (60,120,450)),price numeric(12,2) NOT NULL CHECK(price>0),price_confirmed boolean NOT NULL DEFAULT false,image text NOT NULL,active boolean NOT NULL DEFAULT true,UNIQUE(blend,volume_ml));
CREATE TABLE public.materials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE,kind text NOT NULL CHECK(kind IN ('ingredient','packaging')),unit text NOT NULL CHECK(unit IN ('kg','litres','pieces')),quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantity>=0),threshold numeric(14,3) NOT NULL DEFAULT 0 CHECK(threshold>=0));
CREATE TABLE public.customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,phone text NOT NULL UNIQUE,location text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',marketing_opt_out boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.bundles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,product_id uuid NOT NULL REFERENCES public.products,quantity integer NOT NULL CHECK(quantity>0),free_quantity integer NOT NULL DEFAULT 0 CHECK(free_quantity>=0 AND free_quantity<quantity),price numeric(12,2) NOT NULL CHECK(price>=0),active boolean NOT NULL DEFAULT false);
CREATE TABLE public.batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text NOT NULL UNIQUE,blend text NOT NULL CHECK(blend IN ('GLT','GOT')),production_date date NOT NULL,use_by date NOT NULL CHECK(use_by>=production_date),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted')),outputs jsonb NOT NULL,inputs jsonb NOT NULL,wastage integer NOT NULL DEFAULT 0 CHECK(wastage>=0),notes text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES public.profiles,verified_by uuid REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz);
CREATE TABLE public.stock_lots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES public.products,batch_id uuid NOT NULL REFERENCES public.batches,batch_reference text NOT NULL,quantity integer NOT NULL CHECK(quantity>=0),reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=quantity),use_by date NOT NULL,held boolean NOT NULL DEFAULT false,UNIQUE(batch_id,product_id));
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text NOT NULL UNIQUE DEFAULT ('KA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),customer_id uuid REFERENCES public.customers,customer_name text NOT NULL,phone text NOT NULL,location text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',lines jsonb NOT NULL,status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','packed','dispatched','delivered','cancelled')),total numeric(12,2) NOT NULL CHECK(total>=0),paid numeric(12,2) NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=total),delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(delivery_fee>=0),discount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount>=0),delivery_date date NOT NULL,rider_id uuid REFERENCES public.profiles,exception_reason text NOT NULL DEFAULT '',source text NOT NULL CHECK(source IN ('staff','web')),idempotency_key uuid UNIQUE,created_by uuid REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz);
CREATE TABLE public.allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.orders,lot_id uuid NOT NULL REFERENCES public.stock_lots,quantity integer NOT NULL CHECK(quantity>0),state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','consumed','released')),UNIQUE(order_id,lot_id));
CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.orders,amount numeric(12,2) NOT NULL CHECK(amount>0),method text NOT NULL CHECK(method IN ('M-PESA','Cash','Bank')),reference text NOT NULL UNIQUE,created_by uuid NOT NULL REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text NOT NULL UNIQUE,supplier text NOT NULL,description text NOT NULL,date date NOT NULL,kind text NOT NULL CHECK(kind IN ('purchase','expense')),amount numeric(12,2) NOT NULL CHECK(amount>0),lines jsonb NOT NULL DEFAULT '[]',status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted')),created_by uuid NOT NULL REFERENCES public.profiles,verified_by uuid REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz);
CREATE TABLE public.movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item text NOT NULL,product_id uuid REFERENCES public.products,material_id uuid REFERENCES public.materials,lot_id uuid REFERENCES public.stock_lots,quantity numeric(14,3) NOT NULL,reason text NOT NULL,reference text NOT NULL,actor uuid REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"from" date NOT NULL,"to" date NOT NULL CHECK("to">="from"),checks jsonb NOT NULL,reviewer text NOT NULL,reviewer_id uuid NOT NULL REFERENCES public.profiles,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action text NOT NULL,record_id uuid,actor uuid REFERENCES public.profiles,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.stock_lots(product_id,use_by);
CREATE INDEX ON public.orders(created_at);
CREATE INDEX ON public.orders(phone,created_at);
CREATE INDEX ON public.allocations(order_id,state);
CREATE FUNCTION public.kinga_today() RETURNS date LANGUAGE sql STABLE SET search_path=public AS $$ SELECT (now() AT TIME ZONE 'Africa/Nairobi')::date $$;
CREATE FUNCTION public.kinga_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
CREATE FUNCTION public.kinga_require(roles text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL OR NOT coalesce(public.kinga_role()=ANY(roles),false) THEN RAISE EXCEPTION 'This operation is outside your role' USING ERRCODE='42501'; END IF; END $$;
-- Direct client writes are never granted. Read policies are independent of the UI.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','products','materials','customers','bundles','batches','stock_lots','orders','allocations','payments','purchases','movements','reviews','audit'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);END LOOP; END $$;
CREATE POLICY read_profiles ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.kinga_role()='admin' OR role='driver' AND public.kinga_role() IN ('sales','cashier'));
CREATE POLICY read_products ON public.products FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','sales','cashier','stock_keeper'));
CREATE POLICY read_bundles ON public.bundles FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','sales','cashier'));
CREATE POLICY read_materials ON public.materials FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper','cashier'));
CREATE POLICY read_customers ON public.customers FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','sales','cashier'));
CREATE POLICY read_batches ON public.batches FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper'));
CREATE POLICY read_lots ON public.stock_lots FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper','cashier','sales'));
CREATE POLICY read_orders ON public.orders FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','sales','cashier') OR public.kinga_role()='driver' AND rider_id=auth.uid());
CREATE POLICY read_allocations ON public.allocations FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper'));
CREATE POLICY read_payments ON public.payments FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','cashier'));
CREATE POLICY read_purchases ON public.purchases FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper','cashier'));
CREATE POLICY read_movements ON public.movements FOR SELECT TO authenticated USING(public.kinga_role() IN ('admin','stock_keeper','cashier'));
CREATE POLICY read_reviews ON public.reviews FOR SELECT TO authenticated USING(public.kinga_role()='admin');
CREATE POLICY read_audit ON public.audit FOR SELECT TO authenticated USING(public.kinga_role()='admin');
CREATE FUNCTION public.kinga_phone(p text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE s text:=regexp_replace(coalesce(p,''),'[^0-9]','','g');BEGIN IF s~'^0[17][0-9]{8}$' THEN s:='254'||substr(s,2);END IF;IF s!~'^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid Kenyan mobile number';END IF;RETURN s;END $$;
CREATE FUNCTION public.kinga_validate_lines(lines jsonb) RETURNS numeric LANGUAGE plpgsql SET search_path=public AS $$ DECLARE l jsonb;total numeric:=0;q numeric;f numeric;price numeric; BEGIN IF jsonb_typeof(lines)!='array' OR jsonb_array_length(lines)<1 OR jsonb_array_length(lines)>50 THEN RAISE EXCEPTION 'Order needs 1 to 50 lines'; END IF;FOR l IN SELECT * FROM jsonb_array_elements(lines) LOOP q:=(l->>'quantity')::numeric;f:=coalesce((l->>'free_quantity')::numeric,0);price:=(l->>'unit_price')::numeric;IF q IS NULL OR q!=trunc(q) OR q<=0 OR q>10000 OR f<0 OR f!=trunc(f) OR f>q OR price IS NULL OR price<0 OR price>100000 THEN RAISE EXCEPTION 'Use whole bottles and valid prices';END IF;IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=(l->>'product_id')::uuid AND active) THEN RAISE EXCEPTION 'Unknown or inactive product';END IF;total:=total+(q-f)*price;END LOOP;RETURN round(total,2);END $$;
-- Central transaction boundary. All wrappers below pass a fixed operation name.
CREATE FUNCTION public.kinga_mutate(action text,p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid; o public.orders%ROWTYPE;b public.batches%ROWTYPE;pr public.purchases%ROWTYPE;l jsonb;r record;lot record;alloc record;qty numeric;take_qty integer;remaining integer;subtotal numeric;fee numeric;disc numeric;newstatus text;phone_value text;customer uuid;claimed_role text:=public.kinga_role();
BEGIN
 IF action IN ('save_order','transition_order') THEN PERFORM public.kinga_require(ARRAY['admin','sales','cashier','driver']);
 ELSIF action IN ('save_batch','post_batch','save_material','hold_lot','adjust_stock') THEN PERFORM public.kinga_require(ARRAY['admin','stock_keeper']);
 ELSIF action IN ('save_purchase','post_purchase') THEN PERFORM public.kinga_require(ARRAY['admin','stock_keeper','cashier']);
 ELSIF action='record_payment' THEN PERFORM public.kinga_require(ARRAY['admin','cashier']);
 ELSIF action='save_customer' THEN PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);
 ELSIF action='update_delivery' THEN PERFORM public.kinga_require(ARRAY['admin','driver']);
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
   IF o.rider_id IS NULL THEN RAISE EXCEPTION 'Assign a rider before dispatch';END IF;
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
  IF claimed_role='driver' AND (o.rider_id IS DISTINCT FROM auth.uid() OR nullif(p_data->>'rider_id','')::uuid IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Drivers cannot reassign deliveries';END IF;
  IF nullif(p_data->>'rider_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(p_data->>'rider_id')::uuid AND role='driver') THEN RAISE EXCEPTION 'Select an active rider';END IF;
  UPDATE public.orders SET delivery_date=(p_data->>'delivery_date')::date,rider_id=nullif(p_data->>'rider_id','')::uuid,exception_reason=coalesce(p_data->>'exception_reason','') WHERE id=o.id;
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
-- Expose only fixed-name wrappers, never the generic security-definer function.
DO $$ DECLARE op text;BEGIN FOREACH op IN ARRAY ARRAY['save_order','transition_order','record_payment','save_batch','post_batch','save_purchase','post_purchase','save_customer','save_material','save_review','save_product','save_bundle','update_delivery','hold_lot','adjust_stock'] LOOP
 EXECUTE format('CREATE FUNCTION public.kinga_%I(p_data jsonb) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$ SELECT public.kinga_mutate(%L,p_data) $fn$',op,op);
 EXECUTE format('REVOKE ALL ON FUNCTION public.kinga_%I(jsonb) FROM PUBLIC,anon',op);
 EXECUTE format('GRANT EXECUTE ON FUNCTION public.kinga_%I(jsonb) TO authenticated',op);
END LOOP;END $$;
CREATE FUNCTION public.kinga_snapshot() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 PERFORM public.kinga_require(ARRAY['admin','sales','cashier','stock_keeper','driver']);
 RETURN jsonb_build_object('role',public.kinga_role(),'name',(SELECT full_name FROM public.profiles WHERE id=auth.uid()),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('available',coalesce((SELECT sum(l.quantity-l.reserved) FROM public.stock_lots l WHERE l.product_id=p.id AND NOT l.held AND l.use_by>=public.kinga_today()),0))) FROM public.products p),'[]'),
 'orders',coalesce((SELECT jsonb_agg(o ORDER BY created_at DESC) FROM public.orders o),'[]'),'batches',coalesce((SELECT jsonb_agg(b ORDER BY created_at DESC) FROM public.batches b),'[]'),
 'materials',coalesce((SELECT jsonb_agg(m ORDER BY name) FROM public.materials m),'[]'),'lots',coalesce((SELECT jsonb_agg(l ORDER BY use_by) FROM public.stock_lots l),'[]'),
 'movements',coalesce((SELECT jsonb_agg(m ORDER BY created_at DESC) FROM public.movements m),'[]'),'purchases',coalesce((SELECT jsonb_agg(p ORDER BY date DESC) FROM public.purchases p),'[]'),
 'customers',coalesce((SELECT jsonb_agg(c ORDER BY name) FROM public.customers c),'[]'),'payments',coalesce((SELECT jsonb_agg(p ORDER BY created_at DESC) FROM public.payments p),'[]'),
 'reviews',coalesce((SELECT jsonb_agg(r ORDER BY created_at DESC) FROM public.reviews r),'[]'),'profiles',coalesce((SELECT jsonb_agg(p) FROM public.profiles p),'[]'),
 'bundles',coalesce((SELECT jsonb_agg(b) FROM public.bundles b),'[]'),'audit',coalesce((SELECT jsonb_agg(a ORDER BY created_at DESC) FROM public.audit a),'[]'));
 END $$;
CREATE FUNCTION public.kinga_catalogue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('products',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'blend',p.blend,'volume_ml',p.volume_ml,'price',p.price,'price_confirmed',p.price_confirmed,'image',p.image,'available',coalesce((SELECT sum(quantity-reserved) FROM public.stock_lots WHERE product_id=p.id AND NOT held AND use_by>=public.kinga_today()),0))) FROM public.products p WHERE active),'[]'),'bundles',coalesce((SELECT jsonb_agg(b) FROM public.bundles b WHERE active),'[]')) $$;
CREATE FUNCTION public.kinga_public_request(p_data jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE phone_value text;item jsonb;lines jsonb:='[]';p public.products%ROWTYPE;bundle public.bundles%ROWTYPE;q integer;subtotal numeric:=0;ref text;key uuid;
BEGIN
 IF octet_length(p_data::text)>16384 THEN RAISE EXCEPTION 'Request is too large';END IF;
 phone_value:=public.kinga_phone(p_data->>'phone');key:=(p_data->>'idempotency_key')::uuid;
 IF key IS NULL THEN RAISE EXCEPTION 'Request reference is required';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(phone_value));
 SELECT reference INTO ref FROM public.orders WHERE idempotency_key=key AND phone=phone_value;IF FOUND THEN RETURN ref;END IF;
 IF (SELECT count(*) FROM public.orders WHERE phone=phone_value AND source='web' AND created_at>now()-interval '10 minutes')>=4 OR (SELECT count(*) FROM public.orders WHERE phone=phone_value AND source='web' AND created_at>now()-interval '1 day')>=15 THEN RAISE EXCEPTION 'Too many requests. Please contact the team.';END IF;
 IF length(trim(coalesce(p_data->>'customer_name','')))<2 OR length(coalesce(p_data->>'customer_name',''))>120 OR length(trim(coalesce(p_data->>'location','')))<2 OR length(coalesce(p_data->>'location',''))>500 OR length(coalesce(p_data->>'notes',''))>2000 THEN RAISE EXCEPTION 'Enter your name and delivery location within the allowed length';END IF;
 IF jsonb_typeof(p_data->'lines')!='array' OR jsonb_array_length(p_data->'lines') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Choose 1 to 20 product lines';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_data->'lines') LOOP
  q:=(item->>'quantity')::integer;IF q IS NULL OR q NOT BETWEEN 1 AND 100 OR (item->>'quantity')::numeric!=q THEN RAISE EXCEPTION 'Request 1 to 100 whole bottles per line';END IF;
  SELECT * INTO STRICT p FROM public.products WHERE id=(item->>'product_id')::uuid AND active;
  -- Public prices are always reconstructed from the catalogue; never trust submitted prices.
  IF nullif(item->>'bundle_id','') IS NOT NULL THEN
   SELECT * INTO STRICT bundle FROM public.bundles WHERE id=(item->>'bundle_id')::uuid AND product_id=p.id AND active;
   IF q!=bundle.quantity THEN RAISE EXCEPTION 'Bundle quantity changed; reload the catalogue';END IF;
   lines:=lines||jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity',q,'free_quantity',bundle.free_quantity,'unit_price',bundle.price/(bundle.quantity-bundle.free_quantity),'bundle_id',bundle.id));subtotal:=subtotal+bundle.price;
  ELSE lines:=lines||jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity',q,'unit_price',p.price,'free_quantity',0));subtotal:=subtotal+q*p.price;END IF;
 END LOOP;
 IF (p_data->>'delivery_date')::date<public.kinga_today() OR (p_data->>'delivery_date')::date>public.kinga_today()+60 THEN RAISE EXCEPTION 'Choose a preferred date within the next 60 days';END IF;
 INSERT INTO public.orders(customer_name,phone,location,notes,lines,total,delivery_date,source,idempotency_key) VALUES(trim(p_data->>'customer_name'),phone_value,p_data->>'location',coalesce(p_data->>'notes',''),lines,round(subtotal,2),(p_data->>'delivery_date')::date,'web',key) RETURNING reference INTO ref;
 RETURN ref;
END $$;
REVOKE ALL ON FUNCTION public.kinga_mutate(text,jsonb),public.kinga_require(text[]),public.kinga_validate_lines(jsonb),public.kinga_phone(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kinga_require(text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.kinga_snapshot() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.kinga_snapshot() TO authenticated;
REVOKE ALL ON FUNCTION public.kinga_catalogue(),public.kinga_public_request(jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.kinga_catalogue(),public.kinga_public_request(jsonb) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.kinga_role(),public.kinga_today() FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.kinga_role(),public.kinga_today() TO authenticated;
INSERT INTO public.products(name,blend,volume_ml,price,image) SELECT CASE blend WHEN 'GLT' THEN 'Ginger · Lemon · Turmeric' ELSE 'Ginger · Orange · Turmeric' END,blend,volume,price,'/images/'||lower(blend)||'.jpg' FROM (VALUES('GLT'),('GOT')) b(blend) CROSS JOIN (VALUES(60,100),(120,200),(450,700)) v(volume,price);
INSERT INTO public.materials(name,kind,unit,threshold) VALUES('Fresh ginger','ingredient','kg',5),('Lemons','ingredient','kg',5),('Oranges','ingredient','kg',5),('Turmeric','ingredient','kg',2),('60 ml bottles','packaging','pieces',100),('120 ml bottles','packaging','pieces',100),('450 ml bottles','packaging','pieces',50),('Gold caps','packaging','pieces',100),('Labels','packaging','pieces',100);
COMMIT;


BEGIN;
CREATE FUNCTION public.kinga_update_request(p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE;subtotal numeric;fee numeric;disc numeric;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);PERFORM pg_advisory_xact_lock(77441126);
 SELECT * INTO STRICT o FROM public.orders WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF o.status!='requested' THEN RAISE EXCEPTION 'Only unconfirmed requests can be edited';END IF;
 subtotal:=public.kinga_validate_lines(p_data->'lines');fee:=(p_data->>'delivery_fee')::numeric;disc:=(p_data->>'discount')::numeric;
 IF fee IS NULL OR disc IS NULL OR fee<0 OR disc<0 OR disc>subtotal THEN RAISE EXCEPTION 'Invalid delivery fee or discount';END IF;
 IF length(trim(coalesce(p_data->>'customer_name','')))<2 OR length(trim(coalesce(p_data->>'location','')))<2 THEN RAISE EXCEPTION 'Customer name and location are required';END IF;
 UPDATE public.orders SET customer_name=p_data->>'customer_name',phone=public.kinga_phone(p_data->>'phone'),location=p_data->>'location',notes=coalesce(p_data->>'notes',''),delivery_date=(p_data->>'delivery_date')::date,lines=p_data->'lines',delivery_fee=fee,discount=disc,total=subtotal+fee-disc WHERE id=o.id;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('update_request',o.id,auth.uid(),jsonb_build_object('before',to_jsonb(o),'after',p_data));RETURN o.id;
END $$;
REVOKE ALL ON FUNCTION public.kinga_update_request(jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.kinga_update_request(jsonb) TO authenticated;
COMMIT;


BEGIN;
CREATE FUNCTION public.kinga_opening_stock(p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;b uuid;p public.products%ROWTYPE;q numeric:=(p_data->>'quantity')::numeric;mat public.materials%ROWTYPE;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin']);PERFORM pg_advisory_xact_lock(77441126);
 IF q IS NULL OR q<=0 OR length(trim(coalesce(p_data->>'reason','')))<3 OR length(trim(coalesce(p_data->>'reference','')))<3 THEN RAISE EXCEPTION 'Enter opening quantity, source reference and reconciliation note';END IF;
 IF p_data->>'item_type'='material' THEN
  SELECT * INTO STRICT mat FROM public.materials WHERE id=(p_data->>'item_id')::uuid;
  IF mat.unit='pieces' AND q!=trunc(q) THEN RAISE EXCEPTION 'Use whole packaging pieces';END IF;
  rid:=mat.id;UPDATE public.materials SET quantity=quantity+q WHERE id=rid;
  INSERT INTO public.movements(item,material_id,quantity,reason,reference,actor) VALUES(mat.name,rid,q,'opening stock: '||(p_data->>'reason'),p_data->>'reference',auth.uid());
 ELSE
  SELECT * INTO STRICT p FROM public.products WHERE id=(p_data->>'item_id')::uuid;
  IF q!=trunc(q) OR (p_data->>'production_date')::date>public.kinga_today() OR (p_data->>'use_by')::date<public.kinga_today() THEN RAISE EXCEPTION 'Use whole bottles and valid approved dates';END IF;
  INSERT INTO public.batches(reference,blend,production_date,use_by,status,outputs,inputs,notes,created_by,verified_by,verified_at) VALUES(p_data->>'reference',p.blend,(p_data->>'production_date')::date,(p_data->>'use_by')::date,'posted',jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity',q)),'[]','Opening stock reconciliation: '||(p_data->>'reason'),auth.uid(),auth.uid(),now()) RETURNING id INTO b;
  INSERT INTO public.stock_lots(product_id,batch_id,batch_reference,quantity,use_by) VALUES(p.id,b,p_data->>'reference',q,(p_data->>'use_by')::date) RETURNING id INTO rid;
  INSERT INTO public.movements(item,product_id,lot_id,quantity,reason,reference,actor) VALUES(p.blend||' '||p.volume_ml||' ml',p.id,rid,q,'opening stock',p_data->>'reference',auth.uid());
 END IF;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('opening_stock',rid,auth.uid(),p_data);RETURN rid;
END $$;
CREATE FUNCTION public.kinga_adjust_material(p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.materials%ROWTYPE;q numeric:=(p_data->>'quantity')::numeric;BEGIN
 PERFORM public.kinga_require(ARRAY['admin','stock_keeper']);PERFORM pg_advisory_xact_lock(77441126);SELECT * INTO STRICT m FROM public.materials WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF q IS NULL OR q=0 OR m.quantity+q<0 OR m.unit='pieces' AND q!=trunc(q) OR length(trim(coalesce(p_data->>'reason','')))<3 THEN RAISE EXCEPTION 'Enter a valid stock correction with a reason; packaging uses whole pieces';END IF;
 UPDATE public.materials SET quantity=quantity+q WHERE id=m.id;INSERT INTO public.movements(item,material_id,quantity,reason,reference,actor) VALUES(m.name,m.id,q,p_data->>'reason','Material correction',auth.uid());INSERT INTO public.audit(action,record_id,actor,details) VALUES('adjust_material',m.id,auth.uid(),p_data);RETURN m.id;
END $$;
CREATE FUNCTION public.kinga_import_customers(p_data jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;n integer:=0;BEGIN
 PERFORM public.kinga_require(ARRAY['admin']);IF jsonb_typeof(p_data->'rows')!='array' OR jsonb_array_length(p_data->'rows')>1000 THEN RAISE EXCEPTION 'Import up to 1000 customers per file';END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_data->'rows') LOOP
 IF length(trim(coalesce(r->>'name','')))<2 THEN RAISE EXCEPTION 'Every customer requires a name';END IF;
 INSERT INTO public.customers(name,phone,location,notes,marketing_opt_out) VALUES(trim(r->>'name'),public.kinga_phone(r->>'phone'),coalesce(r->>'location',''),coalesce(r->>'notes',''),true) ON CONFLICT(phone) DO NOTHING;n:=n+1;
 END LOOP;INSERT INTO public.audit(action,actor,details) VALUES('import_customers',auth.uid(),jsonb_build_object('rows_processed',n));RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.kinga_opening_stock(jsonb),public.kinga_adjust_material(jsonb),public.kinga_import_customers(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kinga_opening_stock(jsonb),public.kinga_adjust_material(jsonb),public.kinga_import_customers(jsonb) TO authenticated;
COMMIT;

-- Customer editing and validation (004)
BEGIN;
CREATE OR REPLACE FUNCTION public.kinga_customer_data(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n text:=regexp_replace(trim(coalesce(p_data->>'name','')),'\s+',' ','g');p text;a text:=trim(coalesce(p_data->>'location',''));notes text:=trim(coalesce(p_data->>'notes',''));
BEGIN
 IF length(n)<2 OR length(n)>100 THEN RAISE EXCEPTION 'Enter a customer name between 2 and 100 characters';END IF;
 IF coalesce(p_data->>'phone','')!~'^[+0-9 () .-]+$' THEN RAISE EXCEPTION 'Enter a valid Kenyan mobile number';END IF;
 p:=public.kinga_phone(p_data->>'phone');
 IF length(a)>500 OR length(a)>0 AND length(a)<5 THEN RAISE EXCEPTION 'Enter an address between 5 and 500 characters, or leave it empty';END IF;
 IF length(notes)>2000 THEN RAISE EXCEPTION 'Keep notes within 2000 characters';END IF;
 RETURN jsonb_build_object('name',n,'phone',p,'location',a,'notes',notes,'marketing_opt_out',coalesce((p_data->>'marketing_opt_out')::boolean,true));
END $$;
CREATE OR REPLACE FUNCTION public.kinga_save_customer(p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb;rid uuid;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);d:=public.kinga_customer_data(p_data);
 INSERT INTO public.customers(name,phone,location,notes,marketing_opt_out) VALUES(d->>'name',d->>'phone',d->>'location',d->>'notes',(d->>'marketing_opt_out')::boolean) RETURNING id INTO rid;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('save_customer',rid,auth.uid(),d);RETURN rid;
END $$;
CREATE OR REPLACE FUNCTION public.kinga_update_customer(p_data jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb;rid uuid:=(p_data->>'id')::uuid;before_record public.customers%ROWTYPE;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','sales','cashier']);d:=public.kinga_customer_data(p_data);
 SELECT * INTO STRICT before_record FROM public.customers WHERE id=rid FOR UPDATE;
 UPDATE public.customers SET name=d->>'name',phone=d->>'phone',location=d->>'location',notes=d->>'notes',marketing_opt_out=(d->>'marketing_opt_out')::boolean WHERE id=rid;
 -- Historical orders retain their recorded customer and delivery details.
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('update_customer',rid,auth.uid(),jsonb_build_object('before',to_jsonb(before_record),'after',d));RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.kinga_customer_data(jsonb),public.kinga_save_customer(jsonb),public.kinga_update_customer(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kinga_customer_data(jsonb),public.kinga_save_customer(jsonb),public.kinga_update_customer(jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';

-- Saved assistant conversations (005)
BEGIN;
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 workspace_role text NOT NULL DEFAULT public.kinga_role(),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(messages)='array' AND jsonb_array_length(messages)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS assistant_conversations_owner_updated ON public.assistant_conversations(owner_id,updated_at DESC);
DROP POLICY IF EXISTS assistant_conversations_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_own ON public.assistant_conversations FOR ALL TO authenticated
 USING(owner_id=auth.uid() AND workspace_role=public.kinga_role())
 WITH CHECK(owner_id=auth.uid() AND workspace_role=public.kinga_role());
REVOKE ALL ON public.assistant_conversations FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.assistant_conversations TO authenticated;
GRANT INSERT(id,owner_id,workspace_role,title,messages,updated_at),UPDATE(title,messages,updated_at) ON public.assistant_conversations TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
