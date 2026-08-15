<script lang="ts">
	import Dashboard from '$lib/components/Dashboard.svelte';

	let { data } = $props();
</script>

{#await data.dashboardState}
	<Dashboard loading />
{:then state}
	<Dashboard dashboard={state.dashboard} error={state.error} />
{/await}
