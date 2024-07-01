import { TimeRange, type DataPoint } from "./types";

/**
 * Returns data within the time range and sums data values that belong to the same nearby date
 */
export function aggregateDataByDates({
  chartData,
  timeRange,
  shouldKeepFuture,
}: {
  chartData: DataPoint[];
  timeRange: TimeRange;
  shouldKeepFuture: boolean;
}) {
  const initialDates: { [key: string]: DataPoint } = {};
  const minDate = getNearestDate(
    new Date(Date.now() - msInRange(timeRange)),
    timeRange
  );

  let currentDate = minDate;
  const maxDateTime = Math.max(...chartData.map((data) => data.x.getTime()));
  const endDateTime = shouldKeepFuture
    ? Math.max(Date.now(), maxDateTime + 24 * 60 * 60 * 1000)
    : Date.now();

  while (currentDate.getTime() <= endDateTime) {
    const nearestDate = getNearestDate(currentDate, timeRange);
    const timeKey = nearestDate.toISOString();
    initialDates[timeKey] = {
      y: 0,
      x: nearestDate,
    };

    const timeIncrement =
      timeRange === TimeRange["1D"] ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    currentDate = new Date(currentDate.getTime() + timeIncrement);
  }

  return Object.values(
    chartData
      .filter(
        (value) =>
          value.x.getTime() >= minDate.getTime() &&
          (shouldKeepFuture || value.x.getTime() <= Date.now())
      )
      .reduce((acc: { [key: string]: DataPoint }, current) => {
        const nearestDate = getNearestDate(current.x, timeRange);
        const timeKey = nearestDate.toISOString();
        acc[timeKey].y += current.y;
        return acc;
      }, initialDates)
  ).sort((a, b) => a.x.getTime() - b.x.getTime());
}

export function msInRange(timeRange: TimeRange) {
  switch (timeRange) {
    case TimeRange["1D"]:
      return 86400000;
    case TimeRange["5D"]:
      return 432000000;
    case TimeRange["2W"]:
      return 1209600000;
    case TimeRange["6M"]:
      return 15778800000;
    case TimeRange["1Y"]:
      return 31557600000;
    case TimeRange.MAX:
      return Date.now() - new Date("09/01/2023").getTime();
  }
}

export function getNearestDate(date: Date, timeRange: TimeRange) {
  const nearestDate = new Date(date.getTime());
  switch (timeRange) {
    case TimeRange["1D"]:
      // Round to nearest hour
      nearestDate.setMinutes(0);
      nearestDate.setSeconds(0);
      nearestDate.setMilliseconds(0);
      return nearestDate;
    case TimeRange["5D"]:
    case TimeRange["2W"]:
      // Round to the nearest day
      nearestDate.setHours(0);
      nearestDate.setMinutes(0);
      nearestDate.setSeconds(0);
      nearestDate.setMilliseconds(0);
      return nearestDate;
    case TimeRange["6M"]:
    case TimeRange["1Y"]:
    case TimeRange.MAX:
      // Round to the nearest month
      nearestDate.setHours(0);
      nearestDate.setMinutes(0);
      nearestDate.setSeconds(0);
      nearestDate.setMilliseconds(0);
      nearestDate.setDate(1);
      return nearestDate;
  }
}

export function getTooltipFormat(timeRange: TimeRange) {
  switch (timeRange) {
    case TimeRange["1D"]:
      return "h A on MMMM Do YYYY";
    case TimeRange["5D"]:
    case TimeRange["2W"]:
      return "MMMM Do YYYY";
    case TimeRange["6M"]:
    case TimeRange["1Y"]:
    case TimeRange.MAX:
      return "MMMM YYYY";
  }
}

export function getRangeText(timeRange: TimeRange, timeDifference: number) {
  switch (timeRange) {
    case TimeRange["1D"]:
    case TimeRange["5D"]:
      const numDays = Math.floor(timeDifference / 1000 / 60 / 60 / 24);
      if (numDays <= 1) {
        return "past day";
      } else {
        return `past ${numDays} days`;
      }
    case TimeRange["2W"]:
      const numWeeks = Math.floor(timeDifference / 1000 / 60 / 60 / 24 / 7);
      return `past ${numWeeks} weeks`;
    case TimeRange["6M"]:
      const numMonths = Math.floor(timeDifference / 1000 / 60 / 60 / 24 / 30);
      return `past ${numMonths} months`;
    case TimeRange["1Y"]:
      const numMonthYears = Math.floor(
        timeDifference / 1000 / 60 / 60 / 24 / 30
      );
      if (numMonthYears === 12) {
        return "past year";
      }
      return `past ${numMonthYears} months`;
    case TimeRange.MAX:
      return "all time";
  }
}
