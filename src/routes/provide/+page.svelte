<script lang="ts">
  import { client, savedNetwork } from "$lib/network/stores";
  import { refreshing } from "$lib/refreshing";
  import {
    RESERVES,
    type ReserveStatusResponse,
  } from "$lib/resources/registry";
  import { Balance } from "$lib/wallet/coin";
  import { get } from "svelte/store";
  import { BigNumber } from "bignumber.js";
  import ReserveWidget from "$lib/components/reserve/ReserveWidget.svelte";
  import WalletInfo from "$lib/components/WalletInfo.svelte";
  import ReserveMigration from "$lib/components/ReserveMigration.svelte";
  import type { PageData } from "./$types";

  export let data: PageData = {
    unstakeAnalyticsData: [],
    incompleteUnstakeAnalytics: [],
  };

  $: allReserves = Object.values(RESERVES[$savedNetwork.chainId]);

  const reserveStatuses = refreshing(
    async () => {
      let c = await get(client);
      if (!c) return {};

      let statuses = await Promise.all(
        allReserves.map(async (reserve) => {
          let status = await c.wasm.queryContractSmart(reserve.address, {
            status: {},
          });

          status.available = Balance.fromAmountDenom(
            status.available,
            reserve.baseDenom
          );
          status.total = Balance.fromAmountDenom(
            status.total,
            reserve.baseDenom
          );
          status.deployed = Balance.fromAmountDenom(
            status.deployed,
            reserve.baseDenom
          );
          status.reserve_redemption_rate = new BigNumber(
            status.reserve_redemption_rate
          );
          return [reserve.address, status] as [string, ReserveStatusResponse];
        })
      );
      return Object.fromEntries(statuses);
    },
    {
      refreshOn: [client],
    }
  );
</script>

<div class="max-w-prose mx-auto">
  <div class="mb-4">
    <ReserveMigration />
  </div>
  <div class="flex items-center justify-between w-full mb-4 gap-4">
    <h1 class="text-2xl xs:text-3xl md:text-4xl text-center">
      Protocol Reserves
    </h1>
    <WalletInfo />
  </div>
</div>
<div
  class="flex flex-col max-w-screen-md mx-auto items-stretch xs:items-start w-full xs:w-fit"
>
  <div
    class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 text-stone-200 w-full xs:w-fit"
  >
    {#each allReserves as reserve}
      {@const status = $reserveStatuses.then((stats) => stats[reserve.address])}
      <ReserveWidget
        {status}
        {reserve}
        query={reserveStatuses}
        class="basis-1/3 mx-4 xs:mx-0"
      />
    {/each}
  </div>
</div>
