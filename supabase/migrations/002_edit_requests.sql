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
