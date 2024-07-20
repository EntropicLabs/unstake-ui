import { getPaginatedUnstakings } from "$lib/db";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals, params }) => {
  const { db } = locals;

  const res = await getPaginatedUnstakings(
    db,
    url.searchParams.get("limit"),
    url.searchParams.get("prevId"),
    url.searchParams.get("prevTimestamp"),
    params.controller
  );

  if (res.error != null) {
    return json({ error: res.error }, { status: res.status });
  }

  return json(res.data);
};
