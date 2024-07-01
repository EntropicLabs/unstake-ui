<script lang="ts" generics="T">
  import "chartjs-adapter-moment";
  import { type DataPoint, TimeRange } from "./types";
  import { aggregateDataByDates, getNearestDate } from "./utils";
  import { icon } from "$lib/resources/registry";
  import DateBarChart from "./DateBarChart.svelte";

  let clazz: string = "";
  export { clazz as class };

  export let data: T[] = [];
  export let dataMap: (data: T) => DataPoint;
  let chartData = data.map(dataMap);
  $: {
    chartData = data.map(dataMap);
    updateGraph();
  }

  export let datasetLabel: string;
  export let yLabel: string;
  export let unit: string;
  export let digitsToRound: number = 6;
  export let iconDenom: string | undefined = undefined;
  export let footerComment = "";
  export let verticalLineIdx = 0;
  export let graphColor = "";

  let timeRange: TimeRange = TimeRange["5D"];
  let aggregatedDates: DataPoint[] = [];
  let totalValue = 0;

  function updateGraph() {
    aggregatedDates = aggregateDataByDates({
      chartData,
      timeRange,
      shouldKeepFuture: false,
    });
    const currentNearestDate = getNearestDate(new Date(), timeRange);
    verticalLineIdx = aggregatedDates
      .map((date, idx) => ({
        x: Math.abs(currentNearestDate.getTime() - date.x.getTime()),
        idx,
      }))
      .toSorted((a, b) => a.x - b.x)[0].idx;

    totalValue = aggregatedDates.reduce((acc, curr) => acc + curr.y, 0);
  }

  function setTimeRange(newTimeRange: TimeRange) {
    timeRange = newTimeRange;
    updateGraph();
  }

  updateGraph();
</script>

<div class={`${clazz} bg-stone-800 rounded-lg py-2 px-2.5`}>
  <p class="text-md text-stone-400">{datasetLabel}</p>
  <div class="flex gap-1 items-center">
    <p class="text-lg bold font-semibold">
      {totalValue.toFixed(digitsToRound)}
      <span class="font-normal">{" "}{unit}</span>
    </p>
    {#if iconDenom != null}
      <svelte:component this={icon(iconDenom)} class="h-6 w-6" />
    {/if}
  </div>

  <div class="flex justify-between">
    {#each Object.values(TimeRange) as range}
      <button
        class={`${timeRange === range ? "text-blue-500" : "text-stone-400"}`}
        on:click={() => setTimeRange(range)}
      >
        {range}
      </button>
    {/each}
  </div>

  <DateBarChart
    chartData={aggregatedDates}
    {datasetLabel}
    {yLabel}
    {unit}
    {timeRange}
    {verticalLineIdx}
    {graphColor}
  />
  {#if footerComment !== ""}
    <span class="mt-2 text-sm italic text-stone-400 text-center">
      {footerComment}
    </span>
  {/if}
</div>
