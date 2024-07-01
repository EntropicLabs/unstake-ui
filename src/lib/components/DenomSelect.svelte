<script lang="ts" generics="T">
  import autoAnimate from "@formkit/auto-animate";
  import { ChevronDown } from "lucide-svelte";

  import { onMount } from "svelte";

  let clazz: string = "";
  export { clazz as class };
  export let items: T[];
  export let meta: {
    icon: (item: T) => any | undefined;
    label: (item: T) => string | undefined;
    filter: (item: T, search: string) => boolean | undefined;
  };
  export let active: T | undefined | null;

  let open = false;
  let search = "";
  let node: HTMLDivElement;
  let assetInput: HTMLInputElement | undefined;

  $: filteredOptions = items.filter(
    (item) => meta.filter(item, search) ?? true
  );

  function handleClickOutside(event: MouseEvent) {
    if (!node.contains(event.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });

  $: open && assetInput && assetInput.focus();
  $: !open && (search = "");
</script>

<div class={clazz}>
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    bind:this={node}
    class="relative inline-block text-left w-full"
    use:autoAnimate={{ duration: 100 }}
  >
    <button
      id="asset"
      type="button"
      class="border bg-neutral-800 rounded-t-md w-full flex justify-center shadow-lg border-neutral-600 hover:border-neutral-500"
      class:rounded-b-md={!open}
      aria-haspopup="true"
      aria-expanded="true"
      on:click={() => {
        open = true;
      }}
    >
      {#if open}
        <div class="absolute w-full h-full px-2 xs:px-4 xs:py-2">
          <input
            bind:this={assetInput}
            bind:value={search}
            class="focus:outline-none bg-transparent w-full h-full text-sm xs:text-base"
          />
        </div>
      {/if}
      {#if active}
        <div
          class="mx-2 my-1 xs:mx-4 xs:my-2 flex flex-row items-stretch h-full"
        >
          <div class:invisible={open} class="flex items-center">
            {#if meta.icon(active)}
              <div class="mr-2">
                <div class="w-5 h-5 xs:h-6 xs:w-6">
                  <svelte:component this={meta.icon(active)} />
                </div>
              </div>
            {/if}
            <p class="text-sm xs:text-base">{meta.label(active) ?? ""}</p>
            <ChevronDown class="w-4 h-4 xs:ml-1 -mr-1" />
          </div>
        </div>
      {/if}
    </button>

    {#if open}
      <div
        class="origin-top-right absolute left-0 w-full rounded-b-md shadow-lg border border-t-0 border-neutral-600 z-10"
      >
        <div
          class="bg-neutral-800 text-sm rounded-b-md"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="asset"
        >
          {#each filteredOptions as m}
            <div
              class="menu-item"
              on:click={(e) => {
                active = m;
                open = false;
                e.stopPropagation();
              }}
            >
              <div class="flex items-center">
                {#if meta.icon(m)}
                  <div class="mr-2">
                    <div class="w-5 h-5 xs:h-6 xs:w-6">
                      <svelte:component this={meta.icon(m)} />
                    </div>
                  </div>
                {/if}
                <p class="text-sm xs:text-base">
                  {meta.label(m)}
                </p>
              </div>
            </div>
          {:else}
            <div class="menu-item text-xs xs:text-sm">
              <p>No items found</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .menu-item {
    @apply flex justify-between cursor-pointer items-center pl-2 py-2 h-8;
    @apply hover:bg-neutral-700 text-gray-400 hover:text-white;
  }
</style>
