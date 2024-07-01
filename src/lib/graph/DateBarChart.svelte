<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import "chartjs-adapter-moment";
  import { type DataPoint, TimeRange, type ChartVerticalLine } from "./types";
  import { getTooltipFormat } from "./utils";

  export let chartData: DataPoint[];
  export let datasetLabel: string;
  export let yLabel: string;
  export let unit: string;
  export let timeRange: TimeRange;
  export let verticalLineIdx: number;
  export let graphColor: string;

  let chart: Chart<any, DataPoint[], unknown> | null;
  let barChart: HTMLCanvasElement | null;

  const data = {
    datasets: [
      {
        label: datasetLabel,
        backgroundColor: "gray",
        borderColor: "gray",
        data: chartData,
      },
    ],
  };

  export const verticalLinePlugin = {
    id: "verticalLines",
    getLinePosition: function (chart: Chart, pointIndex: number) {
      const meta = chart.getDatasetMeta(0);
      const data = meta.data;
      return data[pointIndex].x;
    },
    renderVerticalLine: function (
      chartInstance: Chart,
      pointIndex: number,
      color: string,
      nPoints: number
    ) {
      // don't render if now is the last point
      if (pointIndex === nPoints - 1) {
        return;
      }
      const lineLeftOffset = this.getLinePosition(chartInstance, pointIndex);
      const area = chartInstance.chartArea;
      const context = chartInstance.ctx;
      if (context !== null) {
        context.beginPath();
        context.strokeStyle = color || "#ff0000";
        context.lineWidth = 2;
        context.moveTo(lineLeftOffset, area.top);
        context.lineTo(lineLeftOffset, area.bottom);
        context.stroke();
        context.fillStyle = color || "#ff0000";
      }
    },
    afterDatasetsDraw: function (chart: Chart, args: any, options: any) {
      if (options.lines) {
        options.lines.forEach((line: ChartVerticalLine) =>
          this.renderVerticalLine(
            chart,
            line.pointIndex,
            line.color,
            line.nPoints
          )
        );
      }
    },
  };

  const config = {
    type: "bar",
    data,
    options: {
      ticks: {
        maxTicksLimit: 0,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              return `${context.parsed.y} ${unit}`;
            },
          },
        },
        verticalLines: {
          lines: [
            {
              pointIndex: verticalLineIdx,
              color: "#eab308",
              nPoints: chartData.length,
            },
          ],
        },
      },
      scales: {
        x: {
          type: "time",
          grid: {
            color: "#44403C",
          },
          time: {
            tooltipFormat: getTooltipFormat(timeRange),
          },
          title: {
            display: true,
            text: "Date",
          },
        },
        y: {
          grid: {
            color: "#44403C",
          },
          title: {
            display: true,
            text: yLabel,
          },
        },
      },
    },
  } as const;

  onMount(() => {
    if (barChart == null) {
      return;
    }
    const ctx = barChart.getContext("2d");
    if (ctx == null) {
      return;
    }
    Chart.defaults.color = "#78716C";
    Chart.register(verticalLinePlugin);
    chart = new Chart(ctx, config);
  });

  $: if (chartData) {
    if (chart != null) {
      chart.data.datasets[0].data = chartData;
      chart.data.datasets[0].backgroundColor =
        graphColor === ""
          ? chartData.map((value) =>
              value.x.getTime() > Date.now()
                ? value.y > 0
                  ? "#72b28a"
                  : "#ce6060"
                : value.y > 0
                  ? "#15803d"
                  : "#B91C1C"
            )
          : graphColor;
      chart.options.plugins.verticalLines = {
        lines: [
          {
            pointIndex: verticalLineIdx,
            color: "#eab308",
            nPoints: chartData.length,
          },
        ],
      };

      chart.options.scales = {
        x: {
          type: "time",
          grid: {
            color: "#44403C",
          },
          time: {
            tooltipFormat: getTooltipFormat(timeRange),
          },
          title: {
            display: true,
            text: "Date",
          },
        },
        y: {
          grid: {
            color: "#44403C",
          },
          title: {
            display: true,
            text: yLabel,
          },
        },
      };
      chart.update();
    }
  }
</script>

<canvas bind:this={barChart} width={300} height={300} />
