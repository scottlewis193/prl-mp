<script lang="ts">
	import InstrumentDetails from '$lib/components/InstrumentDetails.svelte';
	import RacerList from '$lib/components/RacerList.svelte';
	import { setExchangePageContext } from '$lib/stores/exchange.svelte.js';
	import { setUserContext, type User } from '$lib/stores/user.svelte.js';
	const { data } = $props();
	let exchangePage = setExchangePageContext();
	let user = setUserContext(data.user as User);
</script>

<div class="flex w-full justify-center">
	<div
		class="grid w-full max-w-[120rem] grid-flow-col grid-cols-2 grid-rows-[7rem_calc(100vh-19rem)] gap-4 p-4"
	>
		<RacerList />
		{#key exchangePage.activeRacer}
			<InstrumentDetails racer={exchangePage.activeRacer} />
		{/key}
	</div>
</div>
