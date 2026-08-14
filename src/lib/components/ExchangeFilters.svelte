<script lang="ts">
	let {
		query = $bindable(''),
		watchlistOnly = $bindable(false)
	}: { query?: string; watchlistOnly?: boolean } = $props();

	function reset() {
		query = '';
		watchlistOnly = false;
	}
</script>

<div class="flex gap-4">
	<label class="sr-only" for="exchange-search">Search racers</label>
	<input
		id="exchange-search"
		bind:value={query}
		class="input input-sm w-full"
		type="search"
		placeholder="Search racers or Pokémon"
	/>
	<button onclick={reset} class="btn btn-sm btn-soft">Reset</button>
</div>
<label class="flex cursor-pointer items-center gap-2">
	<input bind:checked={watchlistOnly} class="checkbox checkbox-sm" type="checkbox" />
	<span>Watchlist only</span>
</label>
