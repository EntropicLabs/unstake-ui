import { env } from "$env/dynamic/private";
const { DATABASE_URL } = env;
import type { PageServerLoad } from "./$types";
import pkg from "pg";

import type {
  UnstakeAnalytics,
  IncompleteUnstakeAnalytics,
} from "$lib/analytics/types";

export const prerender = false;
export const ssr = true;

export const load: PageServerLoad = async () => {
  return {};
};
