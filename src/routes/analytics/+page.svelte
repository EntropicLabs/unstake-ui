<script lang="ts">
  import type { PageData } from "./$types";
  import { DENOMS } from "$lib/resources/denoms";
  import { icon } from "$lib/resources/registry";
  import { getRelativeTime } from "$lib/wallet/utils";
  import { Balance } from "$lib/wallet/coin";
  import { groupBy } from "$lib/analytics/utils";
  import { BigNumber } from "bignumber.js";
  import DateBarChartWrapper from "$lib/graph/DateBarChartWrapper.svelte";
  import DenomSelect from "$lib/components/DenomSelect.svelte";
  import { type UnstakeAnalytics } from "$lib/analytics/types";

  export let data: PageData;
  const { unstakeAnalyticsData, incompleteUnstakeAnalytics } = data;
  const allData = [...unstakeAnalyticsData, ...incompleteUnstakeAnalytics];
  const dataByAsset = groupBy(allData, (d) => d.controller.offer_denom);
  let completeAnalyticsDataByAsset: UnstakeAnalytics[] = [];
  let incompleteAnalyticsDataByAsset: UnstakeAnalytics[] = [];

  let selectedAsset = "ukuji";
  let selectedDataset = dataByAsset.get(selectedAsset)!;
  $: if (selectedAsset) {
    selectedDataset = dataByAsset.get(selectedAsset)!;
    completeAnalyticsDataByAsset = unstakeAnalyticsData.filter(
      (d) => d.controller.offer_denom === selectedAsset
    );
    incompleteAnalyticsDataByAsset = incompleteUnstakeAnalytics.filter(
      (d) => d.controller.offer_denom === selectedAsset
    );
  }

  function formatBalance(balance: Balance) {
    const normalizedBalance = balance.normalized();

    if (normalizedBalance < BigNumber(0.01)) {
      return normalizedBalance.toPrecision(1);
    }

    return balance.humanAmount(2);
  }
</script>

<div class="max-w-screen-lg mx-auto mb-10">
  <div class="flex flex-row justify-between w-full my-4 gap-7">
    <h1 class="text-2xl xs:text-3xl md:text-4xl">Analytics</h1>
    <DenomSelect
      items={[...dataByAsset.keys()]}
      meta={{
        icon: (asset) => icon(asset),
        filter: (asset, search) =>
          DENOMS[asset].name.toLowerCase().includes(search.toLowerCase()),
        label: (asset) => DENOMS[asset].name,
      }}
      bind:active={selectedAsset}
    />
  </div>

  <div
    class="flex flex-col w-full items-center justify-center align-center gap-4 mt-4"
  >
    <div class="flex flex-col md:flex-row items-center md:items-start gap-4 w-full">
      <DateBarChartWrapper
        class="md:basis-1/2 w-full"
        data={selectedDataset}
        dataMap={(d) => ({
          x: d.startTime,
          y: 1,
        })}
        datasetLabel={`Unstake Frequency`}
        yLabel={`Frequency`}
        unit={"Unstakings"}
        digitsToRound={0}
        graphColor="gray"
      />
      <DateBarChartWrapper
        class="md:basis-1/2 w-full"
        data={selectedDataset}
        dataMap={(d) => ({
          x: d.endTime,
          y: new BigNumber(d.pnl)
            .dividedBy(Math.pow(10, DENOMS[selectedAsset].dec))
            .toNumber(),
        })}
        datasetLabel={`Profit & Loss`}
        yLabel={`Value ${DENOMS[selectedDataset[0].controller.offer_denom].name}`}
        unit={DENOMS[selectedDataset[0].controller.offer_denom].name}
        iconDenom={selectedDataset[0].controller.offer_denom}
        shouldKeepFutureToggle
      />
    </div>
  </div>

  <div class="flex flex-col md:flex-row items-center gap-4 mt-4">
    <div class="flex flex-col w-full md:basis-1/2 rounded-lg bg-stone-800 max-h-96 px-2">
      <div class=" bg-stone-800 py-2">
        <p class="text-md text-stone-400">Completed Unstakings</p>
        <p class="text-lg bold font-semibold">
          {completeAnalyticsDataByAsset.length}
          <span class="font-normal"
            >{completeAnalyticsDataByAsset.length === 1
              ? "Unstaking"
              : "Unstakings"}</span
          >
        </p>
      </div>
      <div class="overflow-y-auto">
        <table class="w-full">
          <thead>
            <tr class="text-xs text-stone-500 bg-stone-800 sticky top-0">
              <th class="text-left pt-2 pb-4"></th>
              <th class="text-left pt-2 pb-4">Completed Time</th>
              <th class="text-left pt-2 pb-4">Unbond Amount</th>
              <th class="text-right pt-2 pb-4">NSTK PnL</th>
            </tr>
          </thead>
          <tbody>
            {#each completeAnalyticsDataByAsset as unstake}
              {@const unbondAmount = Balance.fromAmountDenom(
                unstake.unbondAmount,
                unstake.controller.ask_denom
              )}
              {@const pnl = Balance.fromAmountDenom(
                unstake.pnl,
                unstake.controller.offer_denom
              )}
              <tr class="text-sm">
                <td>
                  <svelte:component
                    this={icon(unstake.controller.ask_denom)}
                    class="size-5"
                  />
                </td>
                <td>
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    <div class="flex items-center gap-1 py-1">
                      {getRelativeTime(unstake.endTime, true)} ago
                    </div>
                  </a>
                </td>
                <td class="">
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    {formatBalance(unbondAmount)}
                    <span class="text-stone-500">
                      {unbondAmount.name}
                    </span>
                  </a>
                </td>
                <td class="text-right">
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    {formatBalance(pnl)}
                    <span class="text-stone-500">
                      {pnl.name}
                    </span>
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    <div class="flex flex-col w-full md:basis-1/2 rounded-lg bg-stone-800 max-h-96 px-2">
      <div class="sticky top-0 bg-stone-800 py-2">
        <p class="text-md text-stone-400">Started Unstakings</p>
        <p class="text-lg bold font-semibold">
          {incompleteAnalyticsDataByAsset.length}
          <span class="font-normal"
            >{incompleteAnalyticsDataByAsset.length === 1
              ? "Unstaking"
              : "Unstakings"}</span
          >
        </p>
      </div>
      <div class="overflow-y-auto">
        <table class="w-full">
          <thead>
            <tr class="text-xs text-stone-500 bg-stone-800 sticky top-0">
              <th class="text-left pt-2 pb-4"></th>
              <th class="text-left pt-2 pb-4">Start Time</th>
              <th class="text-left pt-2 pb-4">Unbond Amount</th>
              <th class="text-right pt-2 pb-4">Forecasted PnL</th>
            </tr>
          </thead>
          <tbody>
            {#each incompleteAnalyticsDataByAsset as unstake}
              {@const unbondAmount = Balance.fromAmountDenom(
                unstake.unbondAmount,
                unstake.controller.ask_denom
              )}
              {@const pnl = Balance.fromAmountDenom(
                unstake.pnl,
                unstake.controller.offer_denom
              )}
              <tr class="text-sm">
                <td>
                  <svelte:component
                    this={icon(unstake.controller.ask_denom)}
                    class="size-5"
                  />
                </td>
                <td>
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    <div class="flex items-center gap-1 py-1">
                      {getRelativeTime(unstake.startTime, true)} ago
                    </div>
                  </a>
                </td>
                <td class="">
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    {formatBalance(unbondAmount)}
                    <span class="text-stone-500">
                      {unbondAmount.name}
                    </span>
                  </a>
                </td>
                <td class="text-right">
                  <a
                    href={`https://finder.kujira.network/kaiyo-1/address/${unstake.delegate}`}
                    target="_blank"
                  >
                    {formatBalance(pnl)}
                    <span class="text-stone-500">
                      {pnl.name}
                    </span>
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
