BEGIN;
ALTER TABLE public.purchases ALTER COLUMN reference DROP NOT NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method text CHECK(payment_method IN ('Cash','M-PESA','Bank'));
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;
-- Older records retain an unknown method; their existing reference must remain present.
ALTER TABLE public.purchases ADD CONSTRAINT purchases_payment_reference_required CHECK(payment_method IS NOT DISTINCT FROM 'Cash' OR nullif(trim(reference),'') IS NOT NULL);
CREATE UNIQUE INDEX purchases_normalized_reference_key ON public.purchases(upper(trim(reference))) WHERE reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kinga_save_purchase(p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;method text:=p_data->>'payment_method';ref text:=nullif(trim(p_data->>'reference'),'');amt numeric:=(p_data->>'amount')::numeric;key uuid:=nullif(p_data->>'idempotency_key','')::uuid;line jsonb;kind text:=p_data->>'kind';
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','cashier','stock_keeper']);
 PERFORM pg_advisory_xact_lock(77441126);
 IF method IS NULL OR method NOT IN ('Cash','M-PESA','Bank') THEN RAISE EXCEPTION 'Choose Cash, M-PESA or Bank as the payment method';END IF;
 IF method<>'Cash' AND (ref IS NULL OR length(ref)<2) THEN RAISE EXCEPTION 'A payment reference is required unless payment was cash';END IF;
 IF method='M-PESA' THEN ref:=upper(ref);IF ref!~'^[A-Z0-9]{10}$' THEN RAISE EXCEPTION 'Enter the 10-character M-PESA transaction reference';END IF;END IF;
 IF key IS NULL THEN RAISE EXCEPTION 'Purchase request key is required. Reopen the form and try again';END IF;
 SELECT id INTO rid FROM public.purchases WHERE idempotency_key=key AND created_by=auth.uid();IF FOUND THEN RETURN rid;END IF;
 IF kind IS NULL OR kind NOT IN ('purchase','expense') OR amt IS NULL OR amt<=0 OR amt>100000000 OR amt::text='NaN' OR length(trim(coalesce(p_data->>'description',''))) NOT BETWEEN 2 AND 2000 OR length(coalesce(p_data->>'supplier',''))>200 OR nullif(p_data->>'date','') IS NULL THEN RAISE EXCEPTION 'Enter the item or expense, date and a valid positive amount';END IF;
 IF kind='expense' AND public.kinga_role()='stock_keeper' THEN RAISE EXCEPTION 'Only owner and cashier may record operating expenses';END IF;
 IF jsonb_typeof(p_data->'lines') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Provide material receipt lines or an empty list for expenses';END IF;
 IF kind='purchase' AND jsonb_array_length(p_data->'lines')<1 THEN RAISE EXCEPTION 'Record material quantities received';END IF;
 IF kind='expense' AND jsonb_array_length(p_data->'lines')<>0 THEN RAISE EXCEPTION 'Operating expenses cannot add material stock';END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(p_data->'lines') LOOP
  IF coalesce((line->>'quantity')::numeric,0)<=0 OR (line->>'quantity')::numeric::text='NaN' OR NOT EXISTS(SELECT 1 FROM public.materials WHERE id=(line->>'material_id')::uuid) THEN RAISE EXCEPTION 'Invalid receipt material or quantity';END IF;
 END LOOP;
 INSERT INTO public.purchases(reference,payment_method,idempotency_key,supplier,description,date,kind,amount,lines,created_by)
 VALUES(ref,method,key,trim(coalesce(p_data->>'supplier','')),trim(p_data->>'description'),(p_data->>'date')::date,kind,round(amt,2),p_data->'lines',auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('save_purchase',rid,auth.uid(),p_data);
 RETURN rid;
END $$;
CREATE OR REPLACE FUNCTION public.kinga_post_purchase(p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pr public.purchases%ROWTYPE;line jsonb;qty numeric;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','cashier','stock_keeper']);
 PERFORM pg_advisory_xact_lock(77441126);
 SELECT * INTO STRICT pr FROM public.purchases WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF pr.status='posted' THEN RETURN pr.id;END IF;
 IF pr.kind='expense' AND public.kinga_role()='stock_keeper' THEN RAISE EXCEPTION 'Expense verification requires owner or cashier';END IF;
 IF pr.kind='purchase' THEN FOR line IN SELECT * FROM jsonb_array_elements(pr.lines) LOOP
  qty:=(line->>'quantity')::numeric;
  UPDATE public.materials SET quantity=quantity+qty WHERE id=(line->>'material_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt material no longer exists';END IF;
  INSERT INTO public.movements(item,material_id,quantity,reason,reference,actor) SELECT name,id,qty,'purchase receipt',coalesce(pr.reference,'PUR-'||pr.id::text),auth.uid() FROM public.materials WHERE id=(line->>'material_id')::uuid;
 END LOOP;END IF;
 UPDATE public.purchases SET status='posted',verified_by=auth.uid(),verified_at=now() WHERE id=pr.id;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('post_purchase',pr.id,auth.uid(),p_data);
 RETURN pr.id;
END $$;
REVOKE ALL ON FUNCTION public.kinga_save_purchase(jsonb),public.kinga_post_purchase(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kinga_save_purchase(jsonb),public.kinga_post_purchase(jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
