<script lang="ts">
	import type { Racer } from '$lib/types';

	let { racer }: { racer: Racer } = $props();
	const pokemon = $derived(racer.expand?.pokemon);
	const speciesStats = $derived([
		{ label: 'HP', value: pokemon?.stats?.hp },
		{ label: 'Attack', value: pokemon?.stats?.attack },
		{ label: 'Defense', value: pokemon?.stats?.defense },
		{
			label: 'Special attack',
			value: pokemon?.stats?.specialAttack ?? pokemon?.stats?.spAttack
		},
		{
			label: 'Special defense',
			value: pokemon?.stats?.specialDefense ?? pokemon?.stats?.spDefense
		},
		{ label: 'Speed', value: pokemon?.stats?.speed }
	]);
	const individualTraits = $derived([
		{ label: 'Durability', value: racer.traits?.durability },
		{ label: 'Resilience', value: racer.traits?.resilience },
		{ label: 'Temperament', value: racer.traits?.temperament },
		{ label: 'Consistency', value: racer.traits?.consistency },
		{ label: 'Potential', value: racer.traits?.potential },
		{ label: 'Longevity', value: racer.traits?.longevity }
	]);
</script>

<div class="grid gap-4 md:grid-cols-2">
	<section class="rounded-box bg-base-300 p-4" aria-labelledby="species-stats-heading">
		<h2 id="species-stats-heading" class="font-semibold">Species stats</h2>
		<p class="text-base-content/70 text-sm">{pokemon?.name ?? 'Unknown species'}</p>
		<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
			{#each speciesStats as stat}
				<dt>{stat.label}</dt>
				<dd class="text-right font-medium">{stat.value ?? '—'}</dd>
			{/each}
		</dl>
	</section>

	<section class="rounded-box bg-base-300 p-4" aria-labelledby="individual-traits-heading">
		<h2 id="individual-traits-heading" class="font-semibold">Individual traits</h2>
		<p class="text-base-content/70 text-sm">Personal ratings on a 1–100 scale</p>
		<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
			{#each individualTraits as trait}
				<dt>{trait.label}</dt>
				<dd class="text-right font-medium">{trait.value ?? '—'}</dd>
			{/each}
		</dl>
	</section>
</div>

<dl class="mt-3 grid gap-1 text-sm sm:grid-cols-2">
	<div class="flex justify-between gap-4">
		<dt>Career started</dt>
		<dd>{racer.careerStartedAt ? new Date(racer.careerStartedAt).toLocaleDateString() : '—'}</dd>
	</div>
	<div class="flex justify-between gap-4">
		<dt>Career load</dt>
		<dd>{racer.careerLoad ?? 0} races</dd>
	</div>
</dl>
