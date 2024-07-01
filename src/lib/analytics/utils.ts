import type { IncompleteUnstakeAnalytics, VaultDebts } from "./types";
import { BigNumber } from "bignumber.js";

export function groupBy<T, K>(list: T[], keyGetter: (input: T) => K) {
  const map = new Map<K, T[]>();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

export function estimatePnL(
  unstake: IncompleteUnstakeAnalytics,
  vaultDebtRates: VaultDebts
) {
  const {
    controller,
    debtAmount,
    providerRedemption,
    reserveAmount,
    startTime,
    unbondAmount,
    vaultDebt,
  } = unstake;
  const expectedReturn = BigNumber(providerRedemption).multipliedBy(
    BigNumber(unbondAmount)
  );

  const currentVaultDebt = vaultDebtRates[controller.vault_address];
  const debtRateDelta = BigNumber(currentVaultDebt).minus(BigNumber(vaultDebt));

  const splitDebtAmount = debtAmount.split("factory");
  const debtAmountNum = BigNumber(splitDebtAmount[0]);
  const debtDuringUnstake =
    BigNumber(debtRateDelta).multipliedBy(debtAmountNum);
  const debtBeforeUnstake = debtAmountNum.multipliedBy(BigNumber(vaultDebt));

  const unbondTimeMs = controller.broker.duration * 1000;

  const totalDebt = debtDuringUnstake.plus(debtBeforeUnstake);
  const expectedPnl = expectedReturn
    .minus(totalDebt)
    .minus(BigNumber(reserveAmount));

  return {
    pnl: expectedPnl.toString(),
    endTime: new Date(startTime.getTime() + unbondTimeMs),
  };
}

export function mapNonNull<S, T>(
  list: S[],
  func: (data: S, idx: number) => T | null
) {
  return list.map(func).filter((d) => d != null);
}
