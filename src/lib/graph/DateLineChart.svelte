<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import "chartjs-adapter-moment";
  import {
    type DataPoint,
    TimeRange,
    type ChartVerticalLine,
  } from "./types";
  import { getTooltipFormat } from "./utils";

  export let chartData: DataPoint[];
  export let datasetLabel: string;
  export let yLabel: string;
  export let unit: string;
  export let graphColor: string;
  export let timeRange: TimeRange;
  export let verticalLineIdx: number;

  let chart: Chart<any, DataPoint[], unknown> | null;
  let portfolio: HTMLCanvasElement | null;

  const data = {
    datasets: [
      {
        label: datasetLabel,
        backgroundColor: graphColor,
        borderColor: graphColor,
        fill: false,
        data: chartData,
      },
    ],
  };

  export const verticalLinePlugin = {
    id: "verticalLines",
    getLinePosition: function (chart: Chart, pointIndex: number) {
      const meta = chart.getDatasetMeta(0); // first dataset is used to discover X coordinate of a point
      const data = meta.data;
      const returnVal = data[pointIndex].x;
      return returnVal;
    },
    renderVerticalLine: function (
      chartInstance: Chart,
      pointIndex: number,
      text: string,
      color: string,
      nPoints: number
    ) {
      const lineLeftOffset = this.getLinePosition(chartInstance, pointIndex);
      const area = chartInstance.chartArea;
      const context = chartInstance.ctx;
      // render vertical line
      if (context !== null) {
        context.beginPath();
        context.strokeStyle = color || "#ff0000";
        context.lineWidth = 2;
        context.moveTo(lineLeftOffset, area.top);
        context.lineTo(lineLeftOffset, area.bottom);
        context.stroke();
        // write label
        context.fillStyle = color || "#ff0000";
        const leftQuartile = 0.25 * nPoints;
        const rightQuartile = 0.75 * nPoints;

        let offsetText = "";

        if (nPoints <= 2) {
          if (pointIndex == 1) {
            offsetText =  `${text}             `;
          } else {
            offsetText = `             ${text}`;
          }
        } else {
          offsetText =
          pointIndex < leftQuartile
            ? `  ${text}`
            : pointIndex > rightQuartile
              ? `${text}  `
              : `${text}  `;
        }

        context.textAlign =
          pointIndex < leftQuartile
            ? "left"
            : pointIndex > rightQuartile
              ? "right"
              : "center";
      
        context.fillText(offsetText || "", lineLeftOffset, area.top + 6);
      }
    },
    afterDatasetsDraw: function (chart: Chart, args: any, options: any) {
      if (options.lines) {
        options.lines.forEach((line: ChartVerticalLine) =>
          this.renderVerticalLine(
            chart,
            line.pointIndex,
            line.label,
            line.color,
            line.nPoints
          )
        );
      }
    },
  };

  const config = {
    type: "line",
    data,
    options: {
      ticks: {
        maxTicksLimit: 6
      },
      plugins: {
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
              label: "Now",
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
    if (portfolio == null) {
      return;
    }
    const ctx = portfolio.getContext("2d");
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
      chart.data.datasets[0].borderColor = graphColor;
      chart.data.datasets[0].backgroundColor = graphColor;
      chart.options.plugins.verticalLines = {
        lines: [
          {
            pointIndex: verticalLineIdx,
            label: "Now",
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

<canvas bind:this={portfolio} width={300} height={300} />
