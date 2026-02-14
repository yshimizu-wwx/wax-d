-- 業者が依頼に紐づく畑を取得する際、area_coordinates を GeoJSON で返す RPC
-- （PostGIS の geometry はそのまま select するとバイナリ等になるため ST_AsGeoJSON で明示的に返す）

CREATE OR REPLACE FUNCTION get_work_request_fields_geojson(p_wr_id uuid, p_provider_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  address text,
  area_coordinates json
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.lat,
    f.lng,
    f.address,
    CASE WHEN f.area_coordinates IS NOT NULL
         THEN ST_AsGeoJSON(f.area_coordinates)::json
         ELSE NULL END AS area_coordinates
  FROM work_requests wr
  CROSS JOIN LATERAL unnest(
    CASE WHEN wr.field_ids IS NOT NULL AND array_length(wr.field_ids, 1) > 0
         THEN wr.field_ids ELSE ARRAY[]::text[] END
  ) AS fid
  JOIN fields f ON f.id::text = fid
  WHERE wr.id = p_wr_id AND wr.provider_id = p_provider_id;
$$;

COMMENT ON FUNCTION get_work_request_fields_geojson(uuid, uuid) IS '業者用: 依頼に紐づく畑一覧を area_coordinates を GeoJSON で返す。依頼の field_ids が空の場合は 0 件。';
