export type ValuesUnion<T extends object> = T[keyof T];

export const TimeRange = {
  "1D": "1D",
  "5D": "5D",
  "2W": "2W",
  "6M": "6M",
  "1Y": "1Y",
  MAX: "MAX",
} as const;

export type TimeRange = ValuesUnion<typeof TimeRange>;

export type DataPoint = {
  x: Date;
  y: number;
};

export interface ChartVerticalLine {
  pointIndex: number;
  label: string;
  color: string;
  nPoints: number;
}
