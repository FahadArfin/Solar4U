import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { parse } from "csv-parse";
import pg from "pg";

const archivePath = process.env.SIGNATURE_SOLAR_ARCHIVE || process.argv[2] || "/imports/SignatureSolar.7z";
const sevenZip = process.env.SEVEN_ZIP || (process.platform === "win32" ? "C:\\Program Files\\7-Zip\\7z.exe" : "7z");
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const importId = createHash("sha256").update(`signature-solar:${archivePath}:all_products_data.csv`).digest("hex");
const inferCategory = name => {
  const value = String(name || "").toLowerCase();
  if (/solar panel|bifacial|monofacial|\b\d{3,4}w\b/.test(value)) return "panel";
  if (/battery|lifepo4|powerwall|\bah\b/.test(value)) return "battery";
  if (/inverter|sol-ark|flexboss|gridboss/.test(value)) return "inverter";
  if (/charge controller|mppt|pwm controller/.test(value)) return "charge_controller";
  if (/mount|racking|rail|ground screw|roof hook/.test(value)) return "mounting";
  if (/wire|cable|connector|busbar|breaker|fuse|disconnect/.test(value)) return "wire";
  if (/power station|solar generator/.test(value)) return "power_station";
  return "other";
};

async function main() {
  const existing = await pool.query("select status,row_count from import_jobs where id=$1", [importId]);
  if (existing.rows[0]?.status === "completed") {
    console.log(JSON.stringify({ status: "already_imported", importId, rows: existing.rows[0].row_count }));
    return;
  }
  await pool.query(`insert into retailers(id,name,base_url,status) values('signature-solar','Signature Solar','https://signaturesolar.com','enabled') on conflict(id) do nothing`);
  await pool.query(`insert into import_jobs(id,source,status,started_at) values($1,$2,'running',now()) on conflict(id) do update set status='running',started_at=now(),error=null`, [importId, archivePath]);
  const child = spawn(sevenZip, ["e", "-so", "--", archivePath, "all_products_data.csv"], { stdio: ["ignore", "pipe", "pipe"] });
  const childExit = new Promise(resolve => child.once("close", resolve));
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  const parser = child.stdout.pipe(parse({ columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }));
  let rows = 0;
  let rejected = 0;
  let batch = [];
  const flush = async records => {
    if (!records.length) return;
    const productIds = records.map(record => record.productId);
    const names = records.map(record => record.name);
    const categories = records.map(record => record.category);
    const descriptions = records.map(record => record.description);
    const links = records.map(record => record.link);
    const prices = records.map(record => record.price);
    const images = records.map(record => record.image);
    const hashes = records.map(record => record.evidenceHash);
    const dates = records.map(record => record.date);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into products(id,name,category,search_text,description)
         select distinct on (id) id,name,category,name,description
         from unnest($1::text[],$2::text[],$3::text[],$4::text[]) as imported(id,name,description,category)
         order by id
         on conflict(id) do update set name=excluded.name,category=excluded.category,search_text=excluded.search_text,description=coalesce(products.description,excluded.description)`,
        [productIds, names, descriptions, categories],
      );
      const offers = await client.query(
        `insert into retailer_offers(retailer_id,product_id,source_url,price,currency,in_stock,condition,image_url,evidence_hash,last_observed_at)
         select 'signature-solar',product_id,source_url,price,'USD',true,'new',image_url,evidence_hash,observed_at
         from (
           select distinct on (source_url) product_id,source_url,price,image_url,evidence_hash,observed_at
           from unnest($1::text[],$2::text[],$3::numeric[],$4::text[],$5::text[],$6::timestamptz[])
             as imported(product_id,source_url,price,image_url,evidence_hash,observed_at)
           order by source_url,observed_at desc
         ) latest
         on conflict(retailer_id,source_url) do update set
           product_id=excluded.product_id,
           price=case when excluded.last_observed_at >= retailer_offers.last_observed_at then excluded.price else retailer_offers.price end,
           image_url=coalesce(excluded.image_url,retailer_offers.image_url),
           last_observed_at=greatest(retailer_offers.last_observed_at,excluded.last_observed_at)
         returning id,source_url`,
        [productIds, links, prices, images, hashes, dates],
      );
      const offerMap = new Map(offers.rows.map(row => [row.source_url, row.id]));
      await client.query(
        `insert into price_observations(offer_id,product_id,retailer_id,price,currency,in_stock,observed_at,evidence_hash,run_id)
         select offer_id::uuid,product_id,'signature-solar',price,'USD',true,observed_at,evidence_hash,$7
         from unnest($1::text[],$2::text[],$3::numeric[],$4::timestamptz[],$5::text[],$6::text[])
           as imported(offer_id,product_id,price,observed_at,evidence_hash,source_url)
         on conflict(offer_id,observed_at) do nothing`,
        [records.map(record => offerMap.get(record.link)), productIds, prices, dates, hashes, links, importId],
      );
      await client.query("commit");
      rows += records.length;
      if (rows % 10000 < records.length) console.log(JSON.stringify({ status: "importing", rows, rejected }));
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };
  for await (const record of parser) {
    const price = Number(record.price);
    const date = new Date(`${record.date}T12:00:00.000Z`);
    if (!record.name || !record.link || !Number.isFinite(price) || Number.isNaN(date.valueOf())) { rejected++; continue; }
    batch.push({
      productId: createHash("sha1").update(`signature-solar|${record.link}`.toLowerCase()).digest("hex"),
      name: record.name,
      description: record.description || null,
      category: inferCategory(record.name),
      link: record.link,
      price,
      image: record.image || null,
      evidenceHash: createHash("sha256").update(`${record.link}|${price}|${record.date}`).digest("hex"),
      date,
    });
    if (batch.length >= 1000) {
      await flush(batch);
      batch = [];
    }
  }
  await flush(batch);
  const exitCode = await childExit;
  if (exitCode !== 0) throw new Error(`7z exited ${exitCode}: ${stderr.slice(-500)}`);
  await pool.query("update import_jobs set status='completed',finished_at=now(),row_count=$2,rejected_count=$3 where id=$1", [importId, rows, rejected]);
  console.log(JSON.stringify({ status: "completed", importId, rows, rejected }));
}

main().catch(async error => {
  console.error(error);
  await pool.query("update import_jobs set status='failed',finished_at=now(),error=$2 where id=$1", [importId, error.message]).catch(() => {});
  process.exitCode = 1;
}).finally(() => pool.end());
