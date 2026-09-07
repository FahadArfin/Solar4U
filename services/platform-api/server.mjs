import { serve, json, readJson } from "../shared/http.mjs";
import { query } from "../shared/postgres.mjs";
import { ensureCatalogSchema } from "../shared/catalog-schema.mjs";
import { applyCommunityMigration, forumRouter } from "./forum.mjs";

const fallbackProducts = [
  { id: "eg4-lifepower4-v2", name: "EG4 LifePower4 V2", brand: "EG4", category: "battery", model: "LifePower4 V2", capacity_wh: 5120, current_price: 1199, retailer: "Signature Solar" },
  { id: "eg4-flexboss21", name: "EG4 FlexBOSS21", brand: "EG4", category: "inverter", model: "FlexBOSS21", watts: 16000, current_price: 4099, retailer: "Signature Solar" },
  { id: "hyperion-400", name: "Hyperion 400W Bifacial", brand: "Hyperion", category: "panel", model: "400W Bifacial", watts: 400, current_price: 112, retailer: "SanTan Solar" },
];
const fallbackGuides = [
  { slug: "series-vs-parallel", title: "Series vs. parallel arrays", category: "array-design", reading_minutes: 12, version: 1 },
  { slug: "wire-overcurrent", title: "Wire and overcurrent sizing", category: "safety", reading_minutes: 18, version: 1 },
  { slug: "battery-bank", title: "48 V battery bank fundamentals", category: "batteries", reading_minutes: 14, version: 1 },
];
async function listProducts(url) {
  const search = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category");
  const pickerCategory = url.searchParams.get("pickerCategory");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const result = await query(
    `select p.id,p.slug,p.name,p.brand,p.category,p.model,p.description,p.watts,p.capacity_wh,p.voltage,
      p.picker_category,p.picker_subcategory,p.specifications,p.taxonomy_confidence,p.taxonomy_source,
      coalesce(p.current_image_url,offers.image_url) image_url,
      offers.current_price,offers.current_high_price,offers.retailer_count,offers.retailer,
      history.historical_low,history.historical_high,offers.last_observed_at
     from products p
     left join lateral (
       select min(o.price) filter(where o.in_stock) current_price,max(o.price) current_high_price,
         count(distinct o.retailer_id) retailer_count,
         (array_agg(r.name order by o.price asc) filter(where o.in_stock))[1] retailer,
         (array_agg(o.image_url order by (o.image_url is not null) desc,o.last_observed_at desc))[1] image_url,
         max(o.last_observed_at) last_observed_at
       from retailer_offers o join retailers r on r.id=o.retailer_id where o.product_id=p.id
     ) offers on true
     left join lateral (
       select min(price) historical_low,max(price) historical_high from price_observations where product_id=p.id
     ) history on true
     where ($1='' or p.search_text ilike '%' || $1 || '%')
       and ($2::text is null or p.category=$2)
       and ($3::text is null or (p.picker_category=$3 and p.taxonomy_confidence >= .6))
     order by current_price nulls last,p.name limit $4 offset $5`,
    [search, category, pickerCategory, limit, offset],
  );
  if (result.rows.length) return result.rows;
  return fallbackProducts.filter(p => (!search || `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase())) && (!category || p.category === category));
}

async function getProductDetail(identifier) {
  const result = await query(
    `select p.id,p.slug,p.name,p.brand,p.model,p.category,p.description,p.watts,p.capacity_wh,p.voltage,
      p.picker_category,p.picker_subcategory,p.specifications,p.taxonomy_confidence,p.taxonomy_source,
      coalesce(p.current_image_url,offers.image_url) current_image_url,
      offers.current_price,history.historical_low,history.historical_high,
      offers.retailer_count,offers.last_observed_at
     from products p
     left join lateral (
       select min(price) filter(where in_stock) current_price,count(distinct retailer_id) retailer_count,
         max(last_observed_at) last_observed_at,
         (array_agg(image_url order by (image_url is not null) desc,last_observed_at desc))[1] image_url
       from retailer_offers where product_id=p.id
     ) offers on true
     left join lateral (
       select min(price) historical_low,max(price) historical_high from price_observations where product_id=p.id
     ) history on true
     where p.id=$1 or p.slug=$1
    `,
    [identifier],
  );
  const product = result.rows[0];
  if (!product) return null;
  const offers = await query(
    `select o.id,o.retailer_id,r.name retailer,r.base_url,o.source_url,o.price,o.original_price,o.shipping,
      o.currency,o.in_stock,o.availability_text,o.condition,o.quantity,o.image_url,o.seller,o.last_observed_at
     from retailer_offers o join retailers r on r.id=o.retailer_id
     where o.product_id=$1 order by o.in_stock desc,(o.price+coalesce(o.shipping,0)) asc`,
    [product.id],
  );
  const history = await query(
    `select po.observed_at::date date,po.retailer_id,r.name retailer,min(po.price) price,
      min(po.shipping) shipping,bool_or(po.in_stock) in_stock
     from price_observations po join retailers r on r.id=po.retailer_id
     where po.product_id=$1
     group by po.observed_at::date,po.retailer_id,r.name
     order by date,retailer`,
    [product.id],
  );
  const votes = await query(
    `select picker_category,count(*)::int votes from product_classification_votes
     where product_id=$1 and status <> 'rejected' group by picker_category order by votes desc`,
    [product.id],
  );
  return { ...product, offers: offers.rows, history: history.rows, classification_votes: votes.rows };
}

const communityMigration = await applyCommunityMigration();
console.log(JSON.stringify({ level: "info", service: "platform-api", event: "community_migration", ...communityMigration }));
const catalogMigration = await ensureCatalogSchema();
console.log(JSON.stringify({ level: "info", service: "platform-api", event: "catalog_migration", ...catalogMigration }));

serve({
  name: "platform-api",
  port: Number(process.env.PORT || 4000),
  readiness: async () => {
    const result = await query("select 1 as ready");
    if (!result.rowCount) throw new Error("database_unavailable");
    return { database: "ready" };
  },
  router: async (request, response, requestId) => {
    const url = new URL(request.url, "http://local");
    if (await forumRouter(request, response, requestId, url)) return true;
    if (request.method === "GET" && url.pathname === "/v1/products") return json(response, 200, { data: await listProducts(url) }, requestId) || true;
    if (request.method === "GET" && url.pathname === "/v1/recommendations") return json(response, 200, { data: fallbackProducts.map((p, i) => ({ ...p, score: 95 - i * 3, evidence: ["price", "documentation", "serviceability"] })) }, requestId) || true;
    if (request.method === "GET" && url.pathname === "/v1/guides") return json(response, 200, { data: fallbackGuides }, requestId) || true;
    if (request.method === "GET" && url.pathname.match(/^\/v1\/products\/[^/]+\/price-history$/)) {
      const productId = url.pathname.split("/")[3];
      const result = await query("select observed_at::date as date, min(price) as price from price_observations where product_id=$1 group by observed_at::date order by date", [productId]);
      return json(response, 200, { data: result.rows }, requestId) || true;
    }
    if (request.method === "POST" && url.pathname.match(/^\/v1\/products\/[^/]+\/classification-votes$/)) {
      const productId = decodeURIComponent(url.pathname.split("/")[3]);
      const body = await readJson(request);
      const allowed = new Set(["generation","inverters","controllers","storage","protection","wiring","mounting","monitoring","tools","other"]);
      if (!allowed.has(body.pickerCategory)) return json(response, 400, { error: "invalid_picker_category" }, requestId) || true;
      await query(
        `insert into product_classification_votes(product_id,user_id,picker_category,note)
         values($1,'00000000-0000-0000-0000-000000000001',$2,$3)
         on conflict(product_id,user_id) do update set picker_category=excluded.picker_category,note=excluded.note,status='pending',created_at=now()`,
        [productId, body.pickerCategory, String(body.note || "").slice(0, 500) || null],
      );
      return json(response, 201, { data: { status: "recorded", pickerCategory: body.pickerCategory } }, requestId) || true;
    }
    if (request.method === "GET" && url.pathname.match(/^\/v1\/products\/[^/]+$/)) {
      const identifier = decodeURIComponent(url.pathname.split("/")[3]);
      const product = await getProductDetail(identifier);
      return json(response, product ? 200 : 404, product ? { data: product } : { error: "product_not_found" }, requestId) || true;
    }
    return false;
  },
});
