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
    return cachedData;
  }

  const data = await postgresQuery(db, query, []);
  await cache.setItem(key, data, { ttl: ttl });
  return data;
}

const postgresQuery = (
  db: pkg.PoolClient,
  text: string,
  params: string[]
) => db.query(text, params);

/**
 * Queries started unstaking records based on cursor pagination parameters.
 * 
 * If prevId and prevTimestamp are not specified, queries the first page. 
 * Otherwise, queries the next page based on prevId and prevTimestamp as cursors.
 * 
 * @param db Postgres DB client
 * @param limit The maximum number of results in a single page
 * @param prevId The id of the last retrieved unstake record.
 * @param prevTimestamp The timestamp of the last retrieved unstake record.
 * @param controller An optional controller for the unstake records
 * @returns An error code and error message if the parameters are invalid. 
 * Otherwise, returns the unstake records.
 */
export const getPaginatedUnstakings = async (
  db: pkg.PoolClient,
  limit: string | null,
  prevId: string | null,
  prevTimestamp: string | null,
  controller: string | null
) => {
  try {
    if (limit == null) {
      return { error: "Please specify a pagination limit size", status: 422 };
    }

    const parsedLimit = parseInt(limit, 10);
    if (parsedLimit > 100 || parsedLimit <= 0) {
      return {
        error: "Please specify a page number between 0 and 100",
        status: 422,
      };
    }

    if (prevId == null && prevTimestamp == null) {
      // Return first page
      const res = await postgresQuery(
        db,
        `
      SELECT "id", "unbondAmount", "borrowAmount" as "offerAmount", "controller", "startTime" as "timestamp", "startBlockHeight"
      FROM unstake
      WHERE NOT ("startBlockHeight"=0) AND ("endBlockHeight"=0)
      ${controller != null ? `AND "controller"='${controller}'` : ""}
      ORDER BY "id" DESC, "startTime" DESC
      LIMIT ${limit}
      `,
        []
      );

      return { data: res.rows };
    }

    if (prevId == null) {
      return {
        error: "Please specify the id of the last retrieved record",
        status: 422,
      };
    }

    if (prevTimestamp == null) {
      return {
        error: "Please specify the timestamp of the last retrieved record",
        status: 422,
      };
    }

    // Apply cursor pagination to fetch the next page
    const res = await postgresQuery(
      db,
      `
    SELECT "id", "unbondAmount", "borrowAmount" as "offerAmount", "controller", "startTime" as "timestamp", "startBlockHeight"
    FROM unstake
    WHERE ("id", "startTime") < (${prevId}, '${prevTimestamp}') 
    AND NOT ("startBlockHeight"=0) AND ("endBlockHeight"=0)
    ${controller != null ? `AND "controller"='${controller}'` : ""}
    ORDER BY "id" DESC, "startTime" DESC
    LIMIT ${limit} 
    `,
      []
    );

    return { data: res.rows };
  } catch (err) {
    console.error(err);
    return { error: "Internal Server Error", status: 500 };
  }
};
