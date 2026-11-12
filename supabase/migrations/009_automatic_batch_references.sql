BEGIN;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;
CREATE OR REPLACE FUNCTION public.kinga_save_batch(p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid;key uuid:=nullif(p_data->>'idempotency_key','')::uuid;blend text:=p_data->>'blend';produced date:=(p_data->>'production_date')::date;prefix text;seq numeric;ref text;prepared jsonb;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin','stock_keeper']);
 PERFORM pg_advisory_xact_lock(77441126);
 IF key IS NULL THEN RAISE EXCEPTION 'Batch request key is required. Reopen the form and try again';END IF;
 SELECT id INTO rid FROM public.batches WHERE idempotency_key=key AND created_by=auth.uid();IF FOUND THEN RETURN rid;END IF;
 IF blend IS NULL OR blend NOT IN ('GLT','GOT') OR produced IS NULL OR produced>public.kinga_today() THEN RAISE EXCEPTION 'Select a blend and a valid production date';END IF;
 prefix:=blend||'-'||to_char(produced,'YYMMDD')||'-';
 SELECT coalesce(max(substring(reference from length(prefix)+1)::numeric),0)+1 INTO seq FROM public.batches WHERE reference ~ ('^'||prefix||'[0-9]+$');
 ref:=prefix||lpad(seq::text,greatest(2,length(seq::text)),'0');
 -- The server owns references. No guessed shelf life or opening stock is generated.
 prepared:=p_data||jsonb_build_object('reference',ref);
 rid:=public.kinga_mutate('save_batch',prepared);
 UPDATE public.batches SET idempotency_key=key WHERE id=rid;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.kinga_save_batch(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kinga_save_batch(jsonb) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
