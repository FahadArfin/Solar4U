import pg from "pg";

const { Pool } = pg;
let pool;

export function db() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_SIZE || 8) });
  return pool;
}

export async function query(text, params = []) {
  if (!process.env.DATABASE_URL) return { rows: [], rowCount: 0 };
  return db().query(text, params);
}

export async function transaction(work) {
  if (!process.env.DATABASE_URL) {
    const error = new Error("database_unavailable");
    error.code = "DATABASE_UNAVAILABLE";
    throw error;
  }
  const client = await db().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
