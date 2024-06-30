<script lang="ts">
  import { setupEventListeners } from "$lib/wallet/adapters";
  import "../app.css";
  import { dev } from "$app/environment";
  import { page } from "$app/stores";

  let PUBLIC_ANALYTICS_ID: string | null = null;
  let PUBLIC_ANALYTICS_URL: string | null = null;
  if (!dev) {
    import("$env/static/public").then((env: any) => {
      if (env["PUBLIC_ANALYTICS_ID"] && env["PUBLIC_ANALYTICS_URL"]) {
        PUBLIC_ANALYTICS_ID = env.PUBLIC_ANALYTICS_ID;
        PUBLIC_ANALYTICS_URL = env.PUBLIC_ANALYTICS_URL;
      }
    });
  }

  setupEventListeners();

  $: path = $page.url.pathname;
</script>

<svelte:head>
  {#if !dev}
    <script
      async
      defer
      data-website-id={PUBLIC_ANALYTICS_ID}
      src={PUBLIC_ANALYTICS_URL}
    ></script>
  {/if}
</svelte:head>

<header class="mt-4">
  <div class="flex justify-between mx-auto p-4">
    <img src="/unstake-name.svg" class="h-12 xs:h-14" alt="Unstake.fi Logo" />
    <nav class="flex gap-1 xs:gap-3 items-center text-sm xs:text-base">
      <a href="/analytics" class:active={path === "/analytics"}>Analytics</a>
      <a href="/provide" class:active={path === "/provide"}>Provide</a>
      <a href="/" class:active={path === "/"}>Unstake</a>
    </nav>
  </div>
</header>

<div class="mt-4 xs:mt-8 mx-4">
  <slot />
</div>

<style lang="postcss">
  :global(html) {
    @apply bg-stone-950;
    @apply text-gray-200 min-h-screen subpixel-antialiased;
  }

  nav a {
    @apply hover:text-amber-500 text-stone-500;
  }
  nav a.active {
    @apply from-red-600 via-red-500 to-amber-500 text-transparent bg-gradient-to-tr bg-clip-text;
  }

  nav a.active:hover {
    @apply text-amber-500;
  }

  /*.coming-soon {
    @apply relative;
  }

  .coming-soon:not(.accessible) {
    @apply cursor-not-allowed;
  }

  .coming-soon.accessible a:not(.active) {
    @apply text-stone-400 hover:text-amber-500;
  }

  .coming-soon:not(.accessible) a:not(.active) {
    @apply text-stone-600 cursor-not-allowed pointer-events-none;
  }

  .coming-soon::after {
    @apply bg-red-600 px-1 py-0.5 rounded-md text-stone-300 opacity-70;
    @apply text-xs absolute -left-4 -top-2.5 text-nowrap -rotate-12;
    content: "Soon";
  }*/
</style>
