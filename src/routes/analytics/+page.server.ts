import type { PageServerLoad } from "./$types";
import pkg from "pg";
import type {
  UnstakeAnalytics,
  IncompleteUnstakeAnalytics,
} from "$lib/analytics/types";
import { CONTROLLERS } from "@entropic-labs/unstake.js";
import { MAINNET } from "$lib/resources/networks";
import { estimatePnL } from "$lib/analytics/utils";
import { mapNonNull } from "../../lib/analytics/utils";
import { CacheContainer } from "node-ts-cache";
import { MemoryStorage } from "node-ts-cache-storage-memory";

const postgresQuery = (db: pkg.PoolClient, text: string, params: string[]) =>
  db.query(text, params);

export const prerender = false;
export const ssr = true;

const COMPLETED_EVENT_KEY = "COMPLETED_EVENT_KEY";
const STARTED_EVENT_KEY = "STARTED_EVENT_KEY";

const cache = new CacheContainer(new MemoryStorage());

async function getCachedAnalytics(
  db: pkg.PoolClient,
  query: string,
  key: string
) {
  const cachedData = await cache.getItem<pkg.QueryResult<any>>(key);

  if (cachedData) {
    return cachedData;
  }

  const data = await postgresQuery(db, query, []);

  await cache.setItem(key, data, { ttl: 300 });

  return data;
}

export const load: PageServerLoad = async ({ locals }) => {
  const { db, rpc } = locals;

  const allVaults = [
    ...new Set(
      Object.values(CONTROLLERS[MAINNET] ?? {}).map(
        (controller) => controller!.vault_address
      )
    ),
  ];

  try {
    const vaultDebtRatios = Promise.all(
      allVaults.map(async (vault) => {
        const status = await rpc.wasm.queryContractSmart(vault, {
          status: {},
        });
        return [vault, status["debt_share_ratio"] as string];
      })
    ).then((res) => Object.fromEntries(res) as Record<string, string>);

    // Query necessary data to calculate analytics for completed Unstake events
    const [completedEventAnalytics, startedEventAnalytics, vaultDebts] =
      await Promise.all([
        getCachedAnalytics(
          db,
          `
        SELECT "endTime", "controller", "delegate", "startTime", "protocolFee", "unbondAmount"
        FROM unstake
        WHERE (NOT "startBlockHeight"=0) AND (NOT "endBlockHeight"=0)
        ORDER BY "endTime" DESC
        `,
          COMPLETED_EVENT_KEY
        ),
        // Query necessary data to calculate analytics for Unstake events that haven't ended
        getCachedAnalytics(
          db,
          `
        SELECT "reserveAmount", "vaultDebt", "delegate", "debtAmount", "providerRedemption", "unbondAmount",  "startTime", "controller"
        FROM unstake
        WHERE (NOT "startBlockHeight"=0) AND ("endBlockHeight"=0)
        ORDER BY "startTime" DESC
        `,
          STARTED_EVENT_KEY
        ),
        // Query vault debts
        vaultDebtRatios,
      ]);

    const incompleteUnstakeAnalytics: IncompleteUnstakeAnalytics[] = mapNonNull(
      startedEventAnalytics.rows,
      (row) => {
        const controller = CONTROLLERS[MAINNET][row.controller];

        if (controller == null) {
          return null;
        }

        return {
          controller,
          debtAmount: row.debtAmount,
          delegate: row.delegate,
          providerRedemption: row.providerRedemption,
          reserveAmount: row.reserveAmount,
          startTime: row.startTime,
          unbondAmount: row.unbondAmount,
          vaultDebt: row.vaultDebt,
        };
      }
    );

    const incompleteUnstakeAnalyticsWithPnL: UnstakeAnalytics[] =
      incompleteUnstakeAnalytics.map((data) => {
        const { pnl, endTime } = estimatePnL(data, vaultDebts);
        return {
          pnl,
          startTime: data.startTime,
          endTime,
          unbondAmount: data.unbondAmount,
          controller: data.controller,
          delegate: data.delegate
        };
      });

    const unstakeAnalyticsData: UnstakeAnalytics[] = mapNonNull(
      completedEventAnalytics.rows,
      (row) => {
        const controller = CONTROLLERS[MAINNET][row.controller];

        if (controller == null) {
          return null;
        }

        return {
          controller: controller,
          delegate: row.delegate,
          endTime: row.endTime,
          pnl: row.protocolFee,
          startTime: row.startTime,
          unbondAmount: row.unbondAmount,
        };
      }
    );
    return {
      unstakeAnalyticsData,
      incompleteUnstakeAnalytics: incompleteUnstakeAnalyticsWithPnL,
    };
  } catch (err) {
    console.error(err);
    return {
      unstakeAnalyticsData: [],
      incompleteUnstakeAnalytics: [],
    };
  }
};
