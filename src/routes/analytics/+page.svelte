<script lang="ts">
  import type { PageData } from "./$types";
  import { DENOMS } from "$lib/resources/denoms";
  import { icon } from "$lib/resources/registry";
  import { getRelativeTime } from "$lib/wallet/utils";
  import { Balance } from "$lib/wallet/coin";
  import { groupBy } from "$lib/analytics/utils";
  import { BigNumber } from "bignumber.js";
  import DateLineChartWrapper from "$lib/graph/DateLineChartWrapper.svelte";
  import DenomSelect from "$lib/components/DenomSelect.svelte";

  export let data: PageData;
  const { unstakeAnalyticsData, incompleteUnstakeAnalytics } = data;
  const allData = [...unstakeAnalyticsData, ...incompleteUnstakeAnalytics];
  const dataByAsset = groupBy(allData, (d) => d.controller.offer_denom);

  let selectedAsset = "ukuji";
  let selectedDataset = dataByAsset.get(selectedAsset)!;
  $: selectedDataset = dataByAsset.get(selectedAsset)!;
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
  <div class="flex flex-row gap-4">
    <div
      class="basis-1/2 rounded-lg bg-stone-800 max-h-72 overflow-y-scroll p-2"
    >
      <table class="w-full">
        <thead>
          <tr class="text-xs text-stone-500">
            <th class="text-left pt-2 pb-4"></th>
            <th class="text-left pt-2 pb-4">Completion</th>
            <th class="text-left pt-2 pb-4">Unbond Amount</th>
            <th class="text-right pt-2 pb-4">NSTK PnL</th>
          </tr>
        </thead>
        <tbody>
          {#each unstakeAnalyticsData as unstake}
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
                <div class="flex items-center gap-1 py-1">
                  {getRelativeTime(unstake.endTime, true)} ago
                </div>
              </td>
              <td class="">
                {unbondAmount.humanAmount(2)}
                <span class="text-stone-500">
                  {unbondAmount.name}
                </span>
              </td>
              <td class="text-right">
                {pnl.humanAmount(2)}
                <span class="text-stone-500">
                  {pnl.name}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div
      class="basis-1/2 rounded-lg bg-stone-800 max-h-72 overflow-y-scroll p-2"
    >
      <table class="w-full">
        <thead>
          <tr class="text-xs text-stone-500">
            <th class="text-left pt-2 pb-4"></th>
            <th class="text-left pt-2 pb-4">Started</th>
            <th class="text-left pt-2 pb-4">Unbond Amount</th>
            <th class="text-right pt-2 pb-4">Forecasted PnL</th>
          </tr>
        </thead>
        <tbody>
          {#each incompleteUnstakeAnalytics as unstake}
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
                <div class="flex items-center gap-1 py-1">
                  {getRelativeTime(unstake.startTime, true)} ago
                </div>
              </td>
              <td class="">
                {unbondAmount.humanAmount(2)}
                <span class="text-stone-500">
                  {unbondAmount.name}
                </span>
              </td>
              <td class="text-right">
                {pnl.humanAmount(2)}
                <span class="text-stone-500">
                  {pnl.name}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div
    class="flex flex-col w-full items-center justify-center align-center gap-4 mt-4"
  >
    <div class="flex gap-4 w-full">
      <DateLineChartWrapper
        class="basis-1/2"
        data={selectedDataset}
        dataMap={(d) => ({
          x: d.startTime,
          y: 1,
        })}
        datasetLabel={`Unstake Frequency`}
        yLabel={`Frequency`}
        unit={"Unstakings"}
        digitsToRound={0}
      />
      <DateLineChartWrapper
        class="basis-1/2"
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
      />
    </div>
  </div>
</div>
