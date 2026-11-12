\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000003');
INSERT INTO public.profiles VALUES('10000000-0000-0000-0000-000000000001','Test owner','admin'),('10000000-0000-0000-0000-000000000002','Test rider','driver'),('10000000-0000-0000-0000-000000000003','Test sales','sales');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
SET LOCAL ROLE authenticated;
DO $$ DECLARE p uuid;m uuid;receipt uuid;b uuid;o uuid;o2 uuid;bad uuid;n integer;ref text;before_count integer;BEGIN
 SELECT id INTO p FROM public.products WHERE blend='GLT' AND volume_ml=120;
 SELECT id INTO m FROM public.materials WHERE name='Fresh ginger';
 receipt:=public.kinga_save_purchase(jsonb_build_object('reference','TEST-RECEIPT','supplier','Test supplier','description','Opening ingredients','date',public.kinga_today(),'kind','purchase','amount',1000,'lines',jsonb_build_array(jsonb_build_object('material_id',m,'quantity',20))));
 PERFORM public.kinga_post_purchase(jsonb_build_object('id',receipt));PERFORM public.kinga_post_purchase(jsonb_build_object('id',receipt));
 IF (SELECT quantity FROM public.materials WHERE id=m)!=20 THEN RAISE EXCEPTION 'receipt double posted';END IF;
 b:=public.kinga_save_batch(jsonb_build_object('reference','TEST-BATCH','blend','GLT','production_date',public.kinga_today(),'use_by',public.kinga_today()+3,'outputs',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',20)),'inputs',jsonb_build_array(jsonb_build_object('material_id',m,'quantity',5))));
 IF (SELECT count(*) FROM public.stock_lots)!=0 THEN RAISE EXCEPTION 'draft created stock';END IF;
 PERFORM public.kinga_post_batch(jsonb_build_object('id',b));PERFORM public.kinga_post_batch(jsonb_build_object('id',b));
 IF (SELECT sum(quantity) FROM public.stock_lots)!=20 OR (SELECT quantity FROM public.materials WHERE id=m)!=15 THEN RAISE EXCEPTION 'production posting failed';END IF;
 -- Failed material consumption must roll back all output and input effects.
 bad:=public.kinga_save_batch(jsonb_build_object('reference','TEST-BAD-BATCH','blend','GLT','production_date',public.kinga_today(),'use_by',public.kinga_today()+3,'outputs',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',20)),'inputs',jsonb_build_array(jsonb_build_object('material_id',m,'quantity',99))));
 BEGIN PERFORM public.kinga_post_batch(jsonb_build_object('id',bad));RAISE EXCEPTION 'expected insufficient materials';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected insufficient materials' THEN RAISE;END IF;END;
 IF (SELECT quantity FROM public.materials WHERE id=m)!=15 OR (SELECT status FROM public.batches WHERE id=bad)!='draft' THEN RAISE EXCEPTION 'failed batch was not rolled back';END IF;
 o:=public.kinga_save_order(jsonb_build_object('customer_name','Test buyer','phone','0712345678','location','Nairobi','delivery_date',public.kinga_today(),'delivery_fee',200,'discount',100,'lines',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',5,'free_quantity',1,'unit_price',200))));
 IF (SELECT total FROM public.orders WHERE id=o)!=900 THEN RAISE EXCEPTION 'free bottle/discount/fee total incorrect';END IF;
 IF (SELECT sum(reserved) FROM public.stock_lots)!=0 THEN RAISE EXCEPTION 'request reserved stock';END IF;
 PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','confirmed'));PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','confirmed'));
 IF (SELECT sum(reserved) FROM public.stock_lots)!=5 THEN RAISE EXCEPTION 'reservation double posted or free bottle omitted';END IF;
 PERFORM public.kinga_update_delivery(jsonb_build_object('id',o,'delivery_date',public.kinga_today(),'rider_id','10000000-0000-0000-0000-000000000002'));
 PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','packed'));
 BEGIN PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','dispatched'));RAISE EXCEPTION 'expected payment guard';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected payment guard' THEN RAISE;END IF;END;
 PERFORM public.kinga_record_payment(jsonb_build_object('order_id',o,'amount',400,'method','Cash','reference','TEST-PAY1'));
 BEGIN PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','dispatched'));RAISE EXCEPTION 'expected partial payment guard';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected partial payment guard' THEN RAISE;END IF;END;
 PERFORM public.kinga_record_payment(jsonb_build_object('order_id',o,'amount',500,'method','M-PESA','reference','TEST-PAY2'));
 PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','dispatched'));
 IF (SELECT sum(quantity) FROM public.stock_lots)!=15 OR (SELECT sum(reserved) FROM public.stock_lots)!=0 THEN RAISE EXCEPTION 'dispatch deductions incorrect';END IF;
 o2:=public.kinga_save_order(jsonb_build_object('customer_name','Second buyer','phone','0712345679','location','Nairobi','delivery_date',public.kinga_today(),'lines',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',16,'unit_price',200))));
 BEGIN PERFORM public.kinga_transition_order(jsonb_build_object('id',o2,'status','confirmed'));RAISE EXCEPTION 'expected oversell guard';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected oversell guard' THEN RAISE;END IF;END;
 IF (SELECT sum(reserved) FROM public.stock_lots)!=0 THEN RAISE EXCEPTION 'failed reservation leaked';END IF;
 PERFORM public.kinga_hold_lot(jsonb_build_object('id',(SELECT id FROM public.stock_lots LIMIT 1),'held',true,'reason','Test hold'));
 BEGIN PERFORM public.kinga_transition_order(jsonb_build_object('id',o2,'status','confirmed'));RAISE EXCEPTION 'expected held stock guard';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected held stock guard' THEN RAISE;END IF;END;
 IF public.kinga_snapshot()->>'role'!='admin' THEN RAISE EXCEPTION 'snapshot role missing';END IF;
 RAISE NOTICE 'PASS: receipt and production idempotence; atomic rollback; discounts/free bottles; reservation; partial payment; dispatch; oversell; holds; authenticated snapshot';
END $$;
RESET ROLE;
-- Exact release, expiry, FEFO, RLS and anonymous boundary.
UPDATE public.stock_lots SET held=false;
DO $$ DECLARE p uuid;b uuid;early uuid;late uuid;o uuid;BEGIN
 SELECT id INTO p FROM public.products WHERE blend='GLT' AND volume_ml=120;SELECT id INTO b FROM public.batches WHERE reference='TEST-BATCH';
 UPDATE public.stock_lots SET use_by=public.kinga_today()-1;
 o:=public.kinga_save_order(jsonb_build_object('customer_name','Expiry buyer','phone','0712345680','location','Nairobi','delivery_date',public.kinga_today(),'lines',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1,'unit_price',200))));
 BEGIN PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','confirmed'));RAISE EXCEPTION 'expected expired guard';EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected expired guard' THEN RAISE;END IF;END;
 UPDATE public.stock_lots SET use_by=public.kinga_today()+3;
 INSERT INTO public.batches(reference,blend,production_date,use_by,outputs,inputs,created_by,status) VALUES('FEFO-TEST','GLT',public.kinga_today(),public.kinga_today()+1,'[]','[]',auth.uid(),'posted') RETURNING id INTO b;
 INSERT INTO public.stock_lots(product_id,batch_id,batch_reference,quantity,use_by) VALUES(p,b,'FEFO-TEST',2,public.kinga_today()+1) RETURNING id INTO early;
 PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','confirmed'));
 IF NOT EXISTS(SELECT 1 FROM public.allocations WHERE order_id=o AND lot_id=early AND quantity=1) THEN RAISE EXCEPTION 'FEFO failed';END IF;
 PERFORM public.kinga_transition_order(jsonb_build_object('id',o,'status','cancelled'));
 IF (SELECT reserved FROM public.stock_lots WHERE id=early)!=0 OR (SELECT quantity FROM public.stock_lots WHERE id=early)!=2 THEN RAISE EXCEPTION 'cancellation did not restore exact lot';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.customers)!=0 OR (SELECT count(*) FROM public.payments)!=0 OR (SELECT count(*) FROM public.batches)!=0 THEN RAISE EXCEPTION 'driver read policies leaked';END IF;
 IF EXISTS(SELECT 1 FROM public.orders WHERE rider_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'driver saw unassigned orders';END IF;
 BEGIN PERFORM public.kinga_save_material('{"name":"Forbidden","kind":"ingredient","unit":"kg"}');RAISE EXCEPTION 'expected role rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE public.profiles SET role='admin' WHERE id=auth.uid();RAISE EXCEPTION 'expected privilege rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ DECLARE catalogue jsonb; p text;ref text;d jsonb;BEGIN
 catalogue:=public.kinga_catalogue();p:=catalogue->'products'->0->>'id';
 d:=jsonb_build_object('idempotency_key',gen_random_uuid(),'customer_name','Public buyer','phone','0712345690','location','Nairobi','delivery_date',CURRENT_DATE,'lines',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2,'unit_price',1,'free_quantity',2)));
 ref:=public.kinga_public_request(d);IF public.kinga_public_request(d)!=ref THEN RAISE EXCEPTION 'public request duplicate';END IF;
 BEGIN PERFORM public.kinga_snapshot();RAISE EXCEPTION 'expected anonymous snapshot rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.kinga_save_material('{}');RAISE EXCEPTION 'expected anonymous mutation rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.kinga_mutate('save_material','{}');RAISE EXCEPTION 'expected generic mutation rejection';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.orders WHERE source='web' AND (total!=(SELECT price*2 FROM public.products WHERE id=(orders.lines->0->>'product_id')::uuid) OR lines->0->>'free_quantity'!='0')) THEN RAISE EXCEPTION 'public price tampering accepted';END IF;RAISE NOTICE 'PASS: FEFO; expiry; exact cancellation; driver RLS; no role escalation; anonymous boundary; authoritative public pricing; public idempotence';END $$;
ROLLBACK;
