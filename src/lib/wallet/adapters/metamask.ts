import { CHAIN_INFO, type NETWORK } from "$lib/resources/networks";
import type { EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/stargate";
import type { TendermintClient } from "@cosmjs/tendermint-rpc";
import { CosmjsOfflineSigner, connectSnap, getSnap, suggestChain } from "@leapwallet/cosmos-snap-provider";
import IconMetaMask from "../icons/IconMetaMask.svelte";
import { convertAccountData, offlineSignerSign } from "./common";
import { ConnectionError, WalletAdapter, type AccountData, type ISigner, type WalletMetadata } from "./types";
import { browser } from "$app/environment";

export class MetaMask implements ISigner {
    private constructor(private acc: AccountData, private signer: OfflineSigner) { }

    public static async connect(chain: NETWORK): Promise<MetaMask> {
        if (!await MetaMask.isInstalled()) {
            throw ConnectionError.NotInstalled;
        }

        try {
            connectSnap();
            await suggestChain(CHAIN_INFO[chain], {});
            const offlineSigner = new CosmjsOfflineSigner(chain);
            const accounts = await offlineSigner.getAccounts();
            if (accounts.length === 0) {
                throw ConnectionError.NoAccounts;
            }
            return new MetaMask(convertAccountData(accounts[0]), offlineSigner);
        } catch (error) {
            console.error(error);
            throw ConnectionError.GenericError;
        }
    }
    public disconnect() { /* noop */ }

    public static metadata: WalletMetadata = {
        adapter: WalletAdapter.MetaMask,
        name: 'MetaMask',
        logo: IconMetaMask,
        canSign: true,
    }
    public getMetadata(): WalletMetadata { return MetaMask.metadata; }

    public static async isInstalled(): Promise<boolean> { return browser && !!(await getSnap()); }

    public account(): AccountData { return this.acc; }

    public async sign(
        client: TendermintClient,
        msgs: EncodeObject[],
        fee: StdFee,
        memo?: string
    ): Promise<Uint8Array> {
        return offlineSignerSign(this.signer, this.acc.address, client, msgs, fee, memo);
    }
}