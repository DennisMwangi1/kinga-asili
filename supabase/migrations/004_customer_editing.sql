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
