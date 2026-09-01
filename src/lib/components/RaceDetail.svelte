<script lang="ts">
	import {
		formatRaceSchedule,
		presentRace,
		presentTrackCharacteristics,
		raceStatusLabel
	} from '$lib/raceDiscovery';
	import type { Race, Racer, RaceTrackType } from '$lib/types';

	let {
		race,
		racers = [],
		racetrack,
		now = new Date()
	}: { race: Race; racers?: Racer[]; racetrack: RaceTrackType; now?: Date } = $props();

	const racePresentation = $derived(presentRace(race, racers, [racetrack]));
	const trackPresentation = $derived(presentTrackCharacteristics(racetrack));
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
				<p class="text-primary mt-1 font-semibold">{racePresentation.formatLabel}</p>
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

	<section aria-labelledby="race-policy-heading">
		<h2 id="race-policy-heading" class="mb-3 text-xl font-semibold">Race consequences</h2>
		<dl class="rounded-box border-base-300 bg-base-200 grid gap-4 border p-4 sm:grid-cols-2">
			<div>
				<dt class="text-sm opacity-70">Ranking</dt>
				<dd>{race.raceFormat?.ranked ? 'Awards league points' : 'Unranked — no league points'}</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Eligibility</dt>
				<dd>
					{race.eligibilityPolicy?.healthEligible ? 'Eligible active racers' : 'Format policy'}
				</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Moves</dt>
				<dd>{race.movePolicy?.enabled ? 'Enabled' : 'Disabled'}</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Prize scale</dt>
				<dd>
					{race.raceFormat?.type === 'exhibition' ? 'Reduced ' : ''}{race.prizeScale ?? 0}× format
					scale
				</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Risk policy</dt>
				<dd>
					{race.riskPolicy?.level ?? 'Standard'} ·
					{Math.round((race.riskPolicy?.incidentMultiplier ?? 1) * 100)}% incident multiplier
				</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Wagering</dt>
				<dd>{race.wageringPolicy?.enabled ? 'Winner market available' : 'Not offered'}</dd>
			</div>
		</dl>
	</section>

	<section aria-labelledby="track-characteristics-heading">
		<h2 id="track-characteristics-heading" class="mb-3 text-xl font-semibold">
			Track characteristics
		</h2>
		<dl
			class="rounded-box border-base-300 bg-base-200 grid grid-cols-2 gap-4 border p-4 sm:grid-cols-4"
		>
			<div>
				<dt class="text-sm opacity-70">Surface</dt>
				<dd>{trackPresentation.surfaceLabel}</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Length</dt>
				<dd>{trackPresentation.length.toLocaleString('en-GB')} px</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Width</dt>
				<dd>{trackPresentation.width} px</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Formats</dt>
				<dd>{trackPresentation.formatLabels.join(', ')}</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Cornering demand</dt>
				<dd>{trackPresentation.corneringDemandPercent}%</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Speed bias</dt>
				<dd>{trackPresentation.speedBiasPercent}%</dd>
			</div>
			<div>
				<dt class="text-sm opacity-70">Risk</dt>
				<dd>{trackPresentation.riskPercent}%</dd>
			</div>
			<div class="col-span-2 sm:col-span-4">
				<dt class="text-sm opacity-70">Hazards</dt>
				<dd>
					{trackPresentation.hazardLabels.length > 0
						? trackPresentation.hazardLabels.join(', ')
						: 'None'}
				</dd>
			</div>
		</dl>
	</section>

	{#if racePresentation.winnerName}
		<section class="alert alert-success" aria-labelledby="winner-heading">
			<div>
				<h2 id="winner-heading" class="font-semibold">Winner</h2>
				<p class="text-lg">{racePresentation.winnerName}</p>
			</div>
		</section>
	{/if}

	{#if racePresentation.prizeStructure.length > 0}
		<section aria-labelledby="prizes-heading">
			<h2 id="prizes-heading" class="mb-3 text-xl font-semibold">Prize structure</h2>
			<ol class="rounded-box border-base-300 bg-base-200 divide-base-300 divide-y border">
				{#each racePresentation.prizeStructure as prize}
					<li class="flex items-center justify-between gap-4 p-4">
						<strong>{ordinal(prize.position)}</strong>
						<span>{prize.amount.toLocaleString('en-GB')} PokéD</span>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<section aria-labelledby="results-heading">
		<h2 id="results-heading" class="mb-3 text-xl font-semibold">Finishing results</h2>
		{#if racePresentation.results.length > 0}
			<ol class="rounded-box border-base-300 bg-base-200 divide-base-300 divide-y border">
				{#each racePresentation.results as result}
					<li class="flex items-center gap-4 p-4">
						<strong class="min-w-20 text-lg">
							{race.raceFormat?.type === 'grand_prix' ? 'Overall ' : ''}{ordinal(result.position)}
						</strong>
						<span class="flex-1">{result.racerName}</span>
						{#if result.className && result.classPosition}
							<span>{result.className} class {ordinal(result.classPosition)}</span>
						{/if}
						{#if result.prizeMoney !== undefined}
							<span>{result.prizeMoney.toLocaleString('en-GB')} PokéD awarded</span>
						{/if}
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
