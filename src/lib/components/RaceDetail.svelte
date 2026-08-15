<script lang="ts">
	import { formatRaceSchedule, presentRace, raceStatusLabel } from '$lib/raceDiscovery';
	import type { Race, Racer, RaceTrackType } from '$lib/types';

	let {
		race,
		racers = [],
		racetrack,
		now = new Date()
	}: { race: Race; racers?: Racer[]; racetrack: RaceTrackType; now?: Date } = $props();

	const racePresentation = $derived(presentRace(race, racers, [racetrack]));
	const ordinal = (position: number) => {
		const remainder = position % 100;
		if (remainder >= 11 && remainder <= 13) return `${position}th`;
		return `${position}${position % 10 === 1 ? 'st' : position % 10 === 2 ? 'nd' : position % 10 === 3 ? 'rd' : 'th'}`;
	};
</script>

<main class="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 overflow-y-auto p-4 pb-8">
	<a class="btn btn-ghost btn-sm self-start" href="/races">← All races</a>
	<header class="rounded-box border-base-300 bg-base-200 border p-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-3xl font-bold">{race.name}</h1>
				<p class="mt-1 opacity-70">{racePresentation.trackName}</p>
			</div>
			<span class="badge badge-lg badge-soft">{raceStatusLabel(race.status)}</span>
		</div>
		<p class="mt-4">{formatRaceSchedule(race.startTime, now)}</p>
		<p class="mt-1">
			{racePresentation.participantCount}
			{racePresentation.participantCount === 1 ? 'participant' : 'participants'}
		</p>
	</header>

	{#if racePresentation.winnerName}
		<section class="alert alert-success" aria-labelledby="winner-heading">
			<div>
				<h2 id="winner-heading" class="font-semibold">Winner</h2>
				<p class="text-lg">{racePresentation.winnerName}</p>
			</div>
		</section>
	{/if}

	<section aria-labelledby="results-heading">
		<h2 id="results-heading" class="mb-3 text-xl font-semibold">Finishing results</h2>
		{#if racePresentation.results.length > 0}
			<ol class="rounded-box border-base-300 bg-base-200 divide-base-300 divide-y border">
				{#each racePresentation.results as result}
					<li class="flex items-center gap-4 p-4">
						<strong class="w-10 text-lg">{ordinal(result.position)}</strong>
						<span>{result.racerName}</span>
					</li>
				{/each}
			</ol>
		{:else if race.status === 'cancelled'}
			<p class="rounded-box bg-base-200 p-4">This race was cancelled, so there are no results.</p>
		{:else}
			<p class="rounded-box bg-base-200 p-4">Results will appear when the race is complete.</p>
		{/if}
	</section>
</main>
