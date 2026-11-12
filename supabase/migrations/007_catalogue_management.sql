BEGIN;
-- Keep the two established blends while allowing additional whole-millilitre bottle sizes.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_volume_ml_check;
ALTER TABLE public.products ADD CONSTRAINT products_volume_ml_check CHECK(volume_ml BETWEEN 1 AND 10000);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
-- Restore the existing catalogue only. No customers, stock or sales are generated.
INSERT INTO public.products(name,blend,volume_ml,price,image,note,description)
SELECT CASE blend WHEN 'GLT' THEN 'Ginger · Lemon · Turmeric' ELSE 'Ginger · Orange · Turmeric' END,blend,volume,price,
 '/images/'||lower(blend)||'.jpg',
 CASE blend WHEN 'GLT' THEN 'Bright, zesty & grounding' ELSE 'Juicy, mellow & warming' END,
 CASE blend WHEN 'GLT' THEN 'A lively lemon-led blend with the warming depth of ginger and turmeric. Your golden reset, bottled.' ELSE 'A smooth, citrus-rich blend balancing sweet orange with fresh ginger and earthy turmeric.' END
FROM (VALUES('GLT'),('GOT')) b(blend) CROSS JOIN (VALUES(60,100),(120,200),(450,700)) v(volume,price)
ON CONFLICT(blend,volume_ml) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kinga_save_product(p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products%ROWTYPE;rid uuid;
BEGIN
 PERFORM public.kinga_require(ARRAY['admin']);
 PERFORM pg_advisory_xact_lock(77441126);
 IF nullif(p_data->>'id','') IS NOT NULL THEN
  SELECT * INTO STRICT p FROM public.products WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF coalesce(p_data->>'blend',p.blend)<>p.blend OR coalesce((p_data->>'volume_ml')::integer,p.volume_ml)<>p.volume_ml THEN
   RAISE EXCEPTION 'Blend and bottle size cannot change on an existing variant. Add a new variant instead';
  END IF;
 ELSE
  p.id:=gen_random_uuid();p.blend:=p_data->>'blend';p.volume_ml:=(p_data->>'volume_ml')::integer;
 END IF;
 p.name:=trim(coalesce(p_data->>'name',p.name,''));
 p.price:=coalesce((p_data->>'price')::numeric,p.price);
 p.image:=trim(coalesce(p_data->>'image',p.image,''));
 p.note:=trim(coalesce(p_data->>'note',p.note,''));
 p.description:=trim(coalesce(p_data->>'description',p.description,''));
 p.active:=coalesce((p_data->>'active')::boolean,p.active,true);
 p.price_confirmed:=coalesce((p_data->>'price_confirmed')::boolean,p.price_confirmed,false);
 IF length(p.name) NOT BETWEEN 2 AND 120 OR p.blend IS NULL OR p.blend NOT IN ('GLT','GOT') OR p.volume_ml IS NULL OR p.volume_ml NOT BETWEEN 1 AND 10000 OR p.price IS NULL OR p.price<=0 OR p.price>100000 OR p.price::text='NaN' THEN
  RAISE EXCEPTION 'Enter a name, GLT or GOT blend, a whole bottle size from 1 to 10000 ml and a positive price';
 END IF;
 IF length(p.image)>2000 OR NOT (p.image ~ '^https://[^/[:space:]]+/' OR p.image ~ '^/[^/[:space:]]') OR length(p.note)>160 OR length(p.description)>2000 THEN
  RAISE EXCEPTION 'Use an HTTPS image URL or local image path, a note up to 160 characters and description up to 2000';
 END IF;
 INSERT INTO public.products(id,name,blend,volume_ml,price,image,note,description,active,price_confirmed)
 VALUES(p.id,p.name,p.blend,p.volume_ml,round(p.price,2),p.image,p.note,p.description,p.active,p.price_confirmed)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,image=excluded.image,note=excluded.note,description=excluded.description,active=excluded.active,price_confirmed=excluded.price_confirmed RETURNING id INTO rid;
 INSERT INTO public.audit(action,record_id,actor,details) VALUES('save_product',rid,auth.uid(),p_data);
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.kinga_save_product(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kinga_save_product(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.kinga_catalogue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('products',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'blend',p.blend,'volume_ml',p.volume_ml,'price',p.price,'price_confirmed',p.price_confirmed,'image',p.image,'note',p.note,'description',p.description,'available',coalesce((SELECT sum(quantity-reserved) FROM public.stock_lots WHERE product_id=p.id AND NOT held AND use_by>=public.kinga_today()),0)) ORDER BY p.blend,p.volume_ml) FROM public.products p WHERE active),'[]'),
 'bundles',coalesce((SELECT jsonb_agg(b) FROM public.bundles b WHERE active AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=b.product_id AND p.active)),'[]'));
$$;
REVOKE ALL ON FUNCTION public.kinga_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kinga_catalogue() TO anon,authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
