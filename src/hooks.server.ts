import { env } from "$env/dynamic/private";
import { connectToDb } from "$lib/db";
import { createKujiraClient } from "$lib/network/connect";
import { MAINNET } from "$lib/resources/networks";
import { HttpClient, Tendermint37Client } from "@cosmjs/tendermint-rpc";
import type { Handle, HandleServerError } from "@sveltejs/kit";

if (!env["RPC_KAIYO_1"]) {
  throw new Error("RPC_KAIYO_1 not found in env");
}

const rpcClient = new HttpClient(env["RPC_KAIYO_1"]);

export const handle: Handle = async ({ event, resolve }) => {
  const [rpc, db] = await Promise.all([
    Tendermint37Client.create(rpcClient).then(
      async (client) =>
        await createKujiraClient(client, MAINNET, env["RPC_kaiyo-1"]!)
    ),
    connectToDb().catch((error) => {
      console.error(`Error connecting to db: ${error}`);
      return null;
    }),
  ]);

  event.locals = { rpc, db };

  const response = await resolve(event);
  db?.release();

  return response;
};

export const handleError: HandleServerError = async ({
  error,
  status,
  message,
}) => {
  if (status !== 404) {
    console.error(error);
  }

  return {
    message,
    status,
  };
};
