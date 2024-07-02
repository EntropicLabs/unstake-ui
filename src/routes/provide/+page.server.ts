import { env } from "$env/dynamic/private";
const { DATABASE_URL } = env;
import type { PageServerLoad } from "./$types";
import pkg from "pg";

import type {
  UnstakeAnalytics,
  IncompleteUnstakeAnalytics,
} from "$lib/analytics/types";
import { RESERVES } from "@entropic-labs/unstake.js";
import { MAINNET } from "$lib/resources/networks";
import type { KujiraClient } from "$lib/network/types";
import {
  HttpClient,
  Tendermint37Client,
  type AbciQueryParams,
} from "@cosmjs/tendermint-rpc";
import { createKujiraClient } from "$lib/network/connect";

export const prerender = false;
export const ssr = true;

async function blockHeightAtTime(date: Date): Promise<number> {
  //https://api.kujira.app/api/block?before=2023-11-08T00:00:00Z
  const url = `https://api.kujira.app/api/block?before=${date.toISOString()}`;
  const res = await fetch(url);
  return (await res.json()).height;
}

async function getHistoricalQuerier(
  block: number,
  rpc: KujiraClient
): Promise<KujiraClient> {
  const rpcClient = new HttpClient(rpc.getRpc());
  const tmClient = await Tendermint37Client.create(rpcClient);

  const originalFn = tmClient["abciQuery"];
  tmClient["abciQuery"] = function (args: AbciQueryParams) {
    let modified = {
      height: block,
      path: args.path,
      data: args.data,
      prove: args.prove,
    };
    return originalFn.apply(this, [modified]);
  };

  return createKujiraClient(tmClient, MAINNET, rpc.getRpc());
}

export const load: PageServerLoad = async ({}) => {
  return {};
  // const { rpc } = locals;
  // const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // const blockHeight = await blockHeightAtTime(oneMonthAgo);
  // const historicalRpc = await getHistoricalQuerier(blockHeight, rpc);

  // const reservesStatus = Object.values(RESERVES[MAINNET]).map(async (reserve) => {
  //   const creationDate = new Date(reserve!.creation * 1000);
  //   const aprDate = oneMonthAgo < creationDate ? creationDate : oneMonthAgo;
  //   console.log(oneMonthAgo.getTime(), creationDate.getTime(), aprDate.getTime())
  //   try {
  //     const status = await historicalRpc.wasm.queryContractSmart(reserve!.address, { status: {} });
  //     const result = { rate: status["reserve_redemption_rate"] as string, date: aprDate.getTime() };
  //     return [reserve!.address, result] as const;
  //   } catch (_) {
  //     return [reserve!.address, { rate: "1.0", date: aprDate.getTime() }] as const;
  //   }
  // });
  // const historical = Object.fromEntries(await Promise.all(reservesStatus));
  // return {
  //   historical,
  // };
};
