import type { DataPoint } from "$lib/graph/types";
import type { CONTROLLERS, RESERVES } from "@entropic-labs/unstake.js";

type ControllerConfig = NonNullable<typeof CONTROLLERS[string][string]>;
export type IncompleteUnstakeAnalytics = {
  debtAmount: string;
  providerRedemption: string;
  reserveAmount: string;
  startTime: Date;
  vaultDebt: string;
  unbondAmount: string;
  controller: ControllerConfig;
};

export type UnstakeAnalytics = {
  pnl: string;
  startTime: Date;
  endTime: Date;
  unbondAmount: string;
  controller: ControllerConfig;
};

export type ControllerAnalytics = {
  controller: string;
  pnlData: DataPoint[];
  frequency: DataPoint[];
  offerDenom: string;
  askDenom: string;
};

export type VaultDebts = {
  [vault: string]: string;
}