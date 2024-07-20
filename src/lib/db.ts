import { env } from "$env/dynamic/private";
import type { CacheContainer } from "node-ts-cache";
import pkg from "pg";

const pool = new pkg.Pool({
  connectionString: env["DATABASE_URL"],
});

export const connectToDb = async () => await pool.connect();

export async function getCachedDBResults(
  cache: CacheContainer,
  db: pkg.PoolClient,
  query: string,
  key: string,
  ttl: number
) {
  const cachedData = await cache.getItem<pkg.QueryResult<any>>(key);

  if (cachedData) {
    console.log("Here");
    return cachedData;
  }

  const data = await postgresQuery(db, query, []);
  await cache.setItem(key, data, { ttl: ttl });
  return data;
}

const postgresQuery = (db: pkg.PoolClient, text: string, params: string[]) =>
  db.query(text, params);
