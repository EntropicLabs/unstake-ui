<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { formatBalanceWithUnit } from "$lib/analytics/utils";
  import DenomSelect from "$lib/components/DenomSelect.svelte";
  import NumberInput from "$lib/components/NumberInput.svelte";
  import ReserveMigration from "$lib/components/ReserveMigration.svelte";
  import TxProgress from "$lib/components/TxProgress.svelte";
  import WalletInfo from "$lib/components/WalletInfo.svelte";
  import Loading from "$lib/components/icons/Loading.svelte";
  import { client, savedNetwork } from "$lib/network/stores";
  import { balances } from "$lib/onchain/queries";
  import type {
    ControllerRates,
    ControllerStatus,
    Offer,
  } from "$lib/onchain/queryTypes";
  import { TxStep, broadcastTx, simulate } from "$lib/onchain/transaction";
  import { refreshing, statusOf } from "$lib/refreshing";
  import { denom } from "$lib/resources/denoms";
  import { msg } from "$lib/resources/msg";
  import {
    CONTROLLERS,
    icon,
    MEMO,
    type ControllerConfig,
  } from "$lib/resources/registry";
  import { Balance } from "$lib/wallet/coin";
  import { signer } from "$lib/wallet/stores";
  import { calculateFee, formatBigNumber } from "$lib/wallet/utils";
  import { GasPrice, type DeliverTxResponse } from "@cosmjs/stargate";
  import autoAnimate from "@formkit/auto-animate";
  import { BigNumber } from "bignumber.js";
  import {
    ChevronsDown,
    ExternalLink,
    Fuel,
    OctagonX,
    TriangleAlert,
  } from "lucide-svelte";
  import { setContext } from "svelte";
  import { derived, get, writable } from "svelte/store";

  const controllers = Object.keys(CONTROLLERS[$savedNetwork.chainId]);
  const defaultController = controllers.length > 0 ? controllers[0] : null;

  const controller = writable(
    browser
      ? ($page.url.searchParams.get("controller") ?? defaultController)
      : defaultController
  );
  $: {
    if (browser && $controller) {
      const nextUrl = new URLSearchParams($page.url.searchParams.toString());
      nextUrl.set("controller", $controller);
      goto(`?${nextUrl.toString()}`);
    }
  }
  setContext("controller", controller);

  const denomMeta = {
    icon: (option: ControllerConfig) => icon(option.askDenom),
    label: (option: ControllerConfig) => denom(option.askDenom)?.name,
    filter: (option: ControllerConfig, search: string) =>
      denom(option.askDenom)?.name.toLowerCase().includes(search.toLowerCase()),
  };

  $: allControllers = CONTROLLERS[$savedNetwork.chainId];
  const selectedConfig = derived(
    [controller, savedNetwork],
    ([$c, $savedNetwork]) => {
      if ($c === null) return null;
      if (CONTROLLERS[$savedNetwork.chainId][$c] === undefined) {
        $controller = defaultController;
        return null;
      }
      return CONTROLLERS[$savedNetwork.chainId][$c];
    }
  );
  const amount = writable("");
  const amountRaw = derived(amount, ($amount) => {
    if (!$amount || !$selectedConfig) return new BigNumber(0);
    const asBalance = Balance.fromHuman($amount, $selectedConfig?.askDenom);
    return asBalance.amount;
  });

  const maxSelectedDenom = derived(
    [signer.resolved, balances.resolved, selectedConfig],
    ([$signer, $balances, $controller]) => {
      if (!$balances || !$controller || !$signer) return undefined;
      return $balances.get($controller.askDenom)?.normalized();
    }
  );

  const denomInputController = writable($selectedConfig);
  $: $denomInputController && ($controller = $denomInputController.address);

  const controllerInfo = refreshing(
    async () => {
      const c = await get(client);
      const addr = get(controller);
      if (!addr) return null;
      const status: Promise<ControllerStatus> = c.wasm.queryContractSmart(
        addr,
        { status: {} }
      );
      const rates: Promise<ControllerRates> = c.wasm.queryContractSmart(addr, {
        rates: {},
      });
      return await Promise.all([status, rates]);
    },
    { refreshOn: [client, controller] }
  );

  const offer = refreshing(
    async () => {
      const c = await get(client);
      const addr = get(controller);
      const amt = get(amountRaw);
      if (!addr) return null;
      if (amt.isNaN() || amt.lte(0)) return null;
      const offer: Offer = await c.wasm.queryContractSmart(addr, {
        offer: { amount: amt.toFixed(0) },
      });

      return {
        amount: Balance.fromAmountDenom(
          offer.amount,
          $selectedConfig!.offerDenom
        ),
        fee: Balance.fromAmountDenom(offer.fee, $selectedConfig!.offerDenom),
      };
    },
    { refreshOn: [client, controller, amountRaw], debounce: 300 }
  );
  const offerResolved = offer.resolved;

  const offerRate = refreshing(
    async () => {
      const info = await get(controllerInfo);
      const o = await get(offer);
      const amt = await get(amountRaw);
      if (!info || !o) return null;
      if (amt.isNaN() || amt.lte(0)) return null;
      return o.amount.amount.div(get(amountRaw));
    },
    { refreshOn: [controllerInfo, offer] }
  );

  const feeFraction = derived(offer.resolved, ($offer) => {
    if (!$offer) return null;
    return $offer.fee.amount.div($offer.amount.amount);
  });

  const status = writable<TxStep>(TxStep.None);

  const msgs = refreshing(
    async () => {
      let $signer = await get(signer);
      let $balances = await get(balances);
      let $offer = await get(offer);
      if (!$signer || !$selectedConfig || !$offer) return null;
      const controllerAddr = $selectedConfig.address;
      if (!controllerAddr) return null;
      if ($amountRaw.isZero()) return null;
      if ($amountRaw.gt($balances.getOrZero($selectedConfig.askDenom).amount))
        return null;

      const unstakeBal = Balance.fromAmountDenom(
        $amountRaw.toFixed(0),
        $selectedConfig.askDenom
      );
      const msgs = [
        msg.wasm.msgExecuteContract({
          sender: $signer.account().address,
          contract: controllerAddr,
          msg: Buffer.from(
            JSON.stringify({
              unstake: {
                max_fee: $offer.fee.amount.toFixed(0),
              },
            })
          ),
          funds: unstakeBal.toCoins(),
        }),
      ];
      return msgs;
    },
    { refreshOn: [client, signer, amountRaw, selectedConfig, offer] }
  );

  enum SimulationError {
    WalletDisconnected = "wallet_disconnected",
    ErrorConstructingMsgs = "error_constructing_msgs",
  }

  const { resolved: signerResolved } = signer;
  const { resolved: msgsResolved } = msgs;
  let showGas: boolean = false;
  $: {
    showGas = !!$signerResolved && !!$msgsResolved;
  }

  const txSim = refreshing(
    async () => {
      const s = await get(signer);
      const c = await get(client);
      if (!s) throw SimulationError.WalletDisconnected;
      const m = await get(msgs);
      if (!m) throw SimulationError.ErrorConstructingMsgs;
      return await simulate(c, s.account(), m, MEMO, status);
    },
    { refreshOn: [msgs, signer, client], debounce: 300 }
  );
  const txSimStatus = statusOf(txSim);

  const showError = (err: unknown) => {
    if (err === SimulationError.WalletDisconnected) {
      return false;
    } else if (err === SimulationError.ErrorConstructingMsgs) {
      return false;
    } else {
      return true;
    }
  };

  const tryParseError = (err: any) => {
    let message = err.toString?.();
    if (message) {
      if (message.includes("Vault") && message.includes("insolvent")) {
        return "Unstake Protocol has insufficient liquidity to fulfill this request.";
      }
      if (
        message.includes("spendable balance") &&
        message.includes("smaller than")
      ) {
        return "Your wallet balance is too low to fulfill this request.";
      }
    }
    return err;
  };

  const estimatedFee = refreshing(
    async () => {
      const s = await get(txSim);
      const fee = calculateFee(
        s.gasInfo!,
        GasPrice.fromString("0.0034ukuji"),
        1.7
      );
      return Balance.from(fee.amount[0]);
    },
    { refreshOn: [txSim] }
  );

  let txPromise: Promise<DeliverTxResponse> | undefined = undefined;
  async function executeUnstake() {
    const s = await get(signer);
    const c = await get(client);
    if (!s) throw new Error("No signer connected");
    const sim = await get(txSim);
    const m = await get(msgs);
    return await broadcastTx(c, s, sim, m!, MEMO, status).then((res) => {
      balances.reload();
      $amount = "";
      return res;
    });
  }

  const mantaSwapRate = refreshing(
    async () => {
      const req = {
        input: {
          denom: $selectedConfig!.askDenom,
          amount: $amountRaw,
          slippage: "0.01",
        },
        output: {
          denom: $selectedConfig!.offerDenom,
        },
      };
      if (!browser) return null;
      const res = await fetch("https://api.mantaswap.app/kaiyo-1/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      }).then((res) => res.json());

      if (res.routes.length > 0) {
        return Balance.fromAmountDenom(
          res.routes[0].amount,
          $selectedConfig!.offerDenom
        );
      } else {
        throw new Error("No routes found");
      }
    },
    {
      refreshOn: [amountRaw, controller],
      debounce: 300,
    }
  );
</script>

<svelte:head>
  <title>UNSTAKE.FI</title>
</svelte:head>

<TxProgress {status} {txPromise} />

<div class="mx-auto max-w-prose">
  <ReserveMigration />
  <h1
    class="text-slate-100 mt-4 xs:mt-8 mb-6 xs:mb-8 text-center text-4xl font-light"
  >
    Don't Wait. <span
      class="bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 text-transparent bg-clip-text font-semibold"
    >
      Unstake.
    </span>
  </h1>

  <div
    class={`bg-neutral-800 rounded-md px-4 py-2 text-stone-200 w-full ${
      $maxSelectedDenom && new BigNumber($amount).gt($maxSelectedDenom)
        ? "border border-red-500"
        : ""
    }`}
    use:autoAnimate={{ duration: 100 }}
  >
    <label
      for="unbondAmount"
      class="block text-sm font-semibold leading-6 text-stone-400"
    >
      You unstake
    </label>
    <div class="flex flex-row items-center">
      <NumberInput
        bind:value={$amount}
        id="unbondAmount"
        class="bg-inherit pt-2 pb-2 text-lg focus:outline-none flex-grow min-w-0"
      />
      <DenomSelect
        items={Object.values(allControllers)}
        meta={denomMeta}
        bind:active={$denomInputController}
        class="bg-neutral-800 text-left text-stone-200"
      />
    </div>
    <div class="flex justify-between items-end">
      <button
        class="flex items-center percentage-button text-xs"
        on:click={(_) => ($amount = $maxSelectedDenom?.toFixed() ?? "0")}
        use:autoAnimate
      >
        <p class="text-stone-500 mr-1">Available:</p>
        {#if $maxSelectedDenom !== undefined}
          <p class="text-inherit">
            {formatBigNumber($maxSelectedDenom, 2)}
          </p>
        {:else}
          <p class="text-red-500">0.00</p>
        {/if}
      </button>
      <div class="flex flex-col items-end mr-1">
        <p class="text-xs text-stone-500 -mb-1 mt-1">Protocol Rate</p>
        {#await $controllerInfo}
          <p class="text-sm">-</p>
        {:then res}
          {#if res && $selectedConfig}
            {@const [_, rates] = res}
            <p class="text-sm">
              {Balance.fromHuman(
                rates.provider_redemption,
                $selectedConfig.offerDenom
              ).display(4)}
            </p>
          {:else}
            <p class="text-sm">-</p>
          {/if}
        {:catch _}
          <p class="text-sm text-red-500">-</p>
        {/await}
      </div>
    </div>
  </div>
  <div class="flex justify-center w-full">
    <div class="p-2 -my-3.5 bg-stone-950 rounded-md z-10">
      <ChevronsDown class="w-5 h-5 text-stone-400" />
    </div>
  </div>
  <div
    class={`bg-neutral-800 rounded-md px-4 py-2 text-stone-200 w-full ${
      $feeFraction && $feeFraction.gt(0.05) ? "border border-amber-500" : ""
    }`}
  >
    <p class="block text-sm font-semibold leading-6 text-stone-400">
      You receive
    </p>
    <div class="flex flex-row items-center">
      <div class="flex-grow pt-4 text-lg">
        {#await $offer}
          <Loading class="w-7 h-7 fill-stone-400" />
        {:then offer}
          {#if offer}
            <p class="text-stone-200">
              {offer.amount.humanAmount(4)}
            </p>
          {:else}
            <p class="text-stone-400">-</p>
          {/if}
        {:catch e}
          <p class="text-red-500">-</p>
        {/await}
      </div>

      <div
        class="flex space-x-2 items-center h-full text-stone-200 px-4 rounded-md"
      >
        {#if $selectedConfig !== null}
          <svelte:component
            this={icon($selectedConfig.offerDenom)}
            class="w-6 h-6"
          />
          <p>{denom($selectedConfig.offerDenom)?.name}</p>
        {/if}
      </div>
    </div>
    <div class="flex justify-between items-end">
      <div use:autoAnimate>
        {#await Promise.all([$mantaSwapRate, $offer]) then [swapReturn, offer]}
          {#if swapReturn && offer}
            {@const difference = offer.amount.sub(swapReturn)}
            {@const differencePct = difference.amount.div(offer.amount.amount)}
            {#if difference.amount.gt(0)}
              <p class="text-xs text-stone-500 -mb-1 mt-1">Compared to DEX</p>
              <p>
                <span
                  class="from-red-600 via-red-500 to-amber-500 text-transparent bg-gradient-to-tr bg-clip-text font-bold"
                >
                  +{formatBalanceWithUnit(difference)} (+{differencePct
                    .times(100)
                    .toFixed(2)}%)
                </span>
              </p>
            {/if}
          {/if}
        {/await}
      </div>
      <div>
        <div class="flex flex-col items-end mr-1">
          <p class="text-xs text-stone-500 -mb-1 mt-1">Unstake Rate</p>
          {#await $offerRate}
            <p class="text-sm">-</p>
          {:then offerRate}
            {#if offerRate && $selectedConfig}
              <p class="text-sm">
                {offerRate.toFixed(4)}
                {Balance.fromHuman("0", $selectedConfig.offerDenom).name}
              </p>
            {:else}
              <p class="text-sm">-</p>
            {/if}
          {:catch _}
            <p class="text-sm text-red-500">-</p>
          {/await}
        </div>
      </div>
    </div>
  </div>
  <div use:autoAnimate>
    {#if $maxSelectedDenom && new BigNumber($amount).gt($maxSelectedDenom)}
      <div class="flex items-center gap-1 text-red-500 mt-1">
        <OctagonX class="w-4 h-4 inline-block" />
        <p class="text-xs">
          Input amount exceeds available balance
          <span class="text-stone-500">
            ({formatBigNumber($maxSelectedDenom, 2)})
          </span>
        </p>
      </div>
    {/if}
    {#if $feeFraction && $feeFraction.gt(0.05)}
      <div class="flex items-center gap-1 text-amber-500 mt-1">
        <TriangleAlert class="w-4 h-4 inline-block" />
        <p class="text-xs">
          High slippage
          <span class="text-stone-500">
            ({formatBigNumber($feeFraction.times(100), 2)}%)
          </span>
        </p>
      </div>
    {/if}
    {#await $estimatedFee then fee}
      <div class="flex items-center gap-1 text-stone-500 mt-1">
        <Fuel class="w-4 h-4 inline-block" />
        <p class="text-xs">
          {fee.display(4)} estimated fee
        </p>
      </div>
    {/await}
  </div>
  <div class="flex justify-between my-2 gap-2 items-center">
    <button
      class={`flex-grow border border-stone-500 bg-stone-700 from-red-700 via-red-500 to-amber-500 px-4 py-2 rounded-md my-2 text-stone-200 hover:border-stone-400 ${
        $txSimStatus !== "success" ? "cursor-not-allowed" : ""
      }`}
      disabled={$txSimStatus !== "success"}
      on:click={() => (txPromise = executeUnstake())}
      id="submit"
    >
      <label
        for="submit"
        class="flex items-center justify-center pointer-events-none gap-1 text-sm xs:text-base"
      >
        {#await $txSim}
          <Loading class="w-6 h-6 fill-stone-400" />
        {:then _}
          <p>Unstake</p>
        {:catch err}
          {#if showError(err)}
            <OctagonX class="w-6 h-6 text-red-500" />
            <p class="text-red-500">Error Simulating Transaction</p>
          {:else}
            <p>Unstake</p>
          {/if}
        {/await}
      </label>
    </button>
    <WalletInfo />
  </div>
  {#await $txSim catch err}
    {#if showError(err)}
      <div
        class="text-neutral-300 text-xs border border-red-500 bg-red-500/50 rounded-md p-2"
      >
        <p>{tryParseError(err)}</p>
      </div>
    {/if}
  {/await}
  {#await $controllerInfo then res}
    {#if res && $selectedConfig}
      {@const [status, rates] = res}
      <div
        class="border border-stone-500 rounded-md flex flex-col gap-2 p-2 text-xs"
      >
        <div class="flex justify-between">
          <p class="text-stone-500">Reserves Available</p>
          <a
            class="flex items-center gap-1 hover:text-red-400"
            href="https://twitter.com/unstake_fi/status/1721892391664361835"
            target="_blank"
          >
            <span>
              {Balance.fromAmountDenom(
                status.reserve_available,
                $selectedConfig.offerDenom
              ).display(4)}
            </span>
            <ExternalLink class="w-4 h-4 inline-block text-stone-400" />
          </a>
        </div>
        <div class="flex justify-between">
          <p class="text-stone-500">Reserves In Use</p>
          <a
            class="flex items-center gap-1 hover:text-red-400"
            href="https://twitter.com/unstake_fi/status/1721892391664361835"
            target="_blank"
          >
            <span>
              {Balance.fromAmountDenom(
                status.reserve_deployed,
                $selectedConfig.offerDenom
              ).display(4)}
            </span>
            <ExternalLink class="w-4 h-4 inline-block text-stone-400" />
          </a>
        </div>
        <div class="flex justify-between">
          <p class="text-stone-500">Total Unstaked</p>
          <p class="text-stone-200">
            {Balance.fromAmountDenom(
              status.total_base,
              $selectedConfig.askDenom
            ).display(4)}
          </p>
        </div>
      </div>
    {/if}
  {/await}
</div>

<style>
  .percentage-button {
    @apply px-1.5 py-1 rounded-md border border-stone-700 hover:border-stone-600 hover:bg-stone-700/50 hover:text-amber-300;
  }
  #submit:disabled {
    @apply text-stone-400 opacity-50;
  }
  #submit:not(:disabled) {
    @apply hover:bg-gradient-to-tr;
  }
</style>
