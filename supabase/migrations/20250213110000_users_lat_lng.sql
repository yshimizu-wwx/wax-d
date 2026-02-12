-- Add lat/lng to users for map initial center (拠点座標). Optional; used by PolygonMap when opening farm registration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lat') THEN
    ALTER TABLE public.users ADD COLUMN lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'lng') THEN
    ALTER TABLE public.users ADD COLUMN lng double precision;
  END IF;
END $$;
