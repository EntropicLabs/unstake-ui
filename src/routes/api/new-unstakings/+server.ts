import { getCachedDBResults } from "$lib/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { CacheContainer } from "node-ts-cache";
import { MemoryStorage } from "node-ts-cache-storage-memory";

const cache = new CacheContainer(new MemoryStorage());
const NEW_UNSTAKINGS_KEY = "NEW_UNSTAKINGS_KEY";
const CACHE_TTL = 300;

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const { db } = locals;

    const controller = url.searchParams.get("controller");
    const key = `${NEW_UNSTAKINGS_KEY}${
      controller != null ? `-${controller}` : ""
    }`;

    const res = await getCachedDBResults(
      cache,
      db,
      `
    SELECT "unbondAmount", "borrowAmount" as "offerAmount", "controller", "startTime", "startBlockHeight"
    FROM unstake
    WHERE (NOT "startBlockHeight"=0) AND ("endBlockHeight"=0)
    ${controller != null ? `AND ("controller"='${controller}')` : ""}
    ORDER BY "startTime" DESC
    `,
      key,
      CACHE_TTL
    );

    return json(res.rows);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
};
