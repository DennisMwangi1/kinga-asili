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
