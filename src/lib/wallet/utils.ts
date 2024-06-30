import { createWasmAminoConverters, wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { Uint64 } from "@cosmjs/math";
import { Registry, coins } from "@cosmjs/proto-signing";
import * as s from "@cosmjs/stargate";
import { GasPrice, defaultRegistryTypes, type StdFee } from "@cosmjs/stargate";
import { ibcTypes } from "@cosmjs/stargate/build/modules";
import type BigNumber from "bignumber.js";
import type { GasInfo } from "cosmjs-types/cosmos/base/abci/v1beta1/abci";


export function getRelativeTime(date: Date, compact: boolean = false): string {
    const relativeSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    return toRoughHumanReadable(relativeSeconds, compact);
}

export function toRoughHumanReadable(seconds: number, compact: boolean = false) {
    const format = (value: number, unit: string) => {
        if (compact) {
            return `${value}${unit[0]}`;
        } else {
            return `${value} ${unit}${value > 1 ? "s" : ""}`;
        }
    }
    const days = Math.floor(seconds / 86400);
    if (days > 0) return format(days, "day");

    const hours = Math.floor(seconds / 3600) % 24;
    if (hours > 0) return format(hours, "hour");

    const minutes = Math.floor(seconds / 60) % 60;
    if (minutes > 0) return format(minutes, "minute");

    if (seconds > 0) return format(Math.floor(seconds), "second");

    return "0 seconds";
}

const types = [
    ...defaultRegistryTypes,
    ...wasmTypes,
    ...ibcTypes,
];

export const protoRegistry = new Registry(types);
export const aminoTypes = (prefix: string): s.AminoTypes =>
    new s.AminoTypes({
        ...s.createBankAminoConverters(),
        ...s.createDistributionAminoConverters(),
        ...s.createFeegrantAminoConverters(),
        ...s.createGovAminoConverters(),
        ...s.createIbcAminoConverters(),
        ...s.createStakingAminoConverters(),
        ...s.createVestingAminoConverters(),
        ...createWasmAminoConverters(),
    });


export function localeDecimalSep() {
    return Intl.NumberFormat()
        .formatToParts(10000.1)
        .find(part => part.type === 'decimal')
        ?.value ?? '.';
}

export function localeThousandsSep() {
    return Intl.NumberFormat()
        .formatToParts(10000.1)
        .find(part => part.type === 'group')
        ?.value ?? ',';
}


export function formatBigNumber(value: BigNumber, decimals: number = 2): string {
    const parts = value.toFixed(decimals, 1).split(".");
    const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, localeThousandsSep());
    if (parts.length === 1) return integer;
    const decimal = parts[1];
    return `${integer}${localeDecimalSep()}${decimal}`;
}

export function calculateFee(gas: number | GasInfo, gasPrice: GasPrice, gasAdjustment: number = 1.0): StdFee {
    if (typeof gas !== "number") {
        gas = parseInt(gas.gasUsed.toString());
    }
    gas = Math.ceil(gas * gasAdjustment);
    const amount = gasPrice.amount.multiply(Uint64.fromNumber(Math.round(gas))).ceil().toString();
    const fee = {
        amount: coins(amount, gasPrice.denom),
        gas: gas.toString(),
    };
    return fee;
}