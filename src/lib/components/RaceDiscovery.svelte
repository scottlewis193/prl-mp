<script lang="ts">
	import {
		classifyRaces,
		formatRaceSchedule,
		presentRace,
		raceStatusLabel
	} from '$lib/raceDiscovery';
	import type { Race, Racer, RaceTrackType } from '$lib/types';

	let {
		races = [],
		racers = [],
		racetracks = [],
		loading = false,
		now = new Date()
	}: {
		races?: Race[];
		racers?: Racer[];
		racetracks?: RaceTrackType[];
		loading?: boolean;
		now?: Date;
	} = $props();

	const groups = $derived(classifyRaces(races));
	const sections = $derived([
		{
			id: 'live',
			heading: 'Live now',
			races: groups.live,
			empty: 'No races are live right now.'
		},
		{
			id: 'upcoming',
			heading: 'Upcoming races',
			races: groups.upcoming,
			empty: 'No upcoming races are scheduled.'
		},
		{
			id: 'completed',
			heading: 'Completed races',
			races: groups.completed,
			empty: 'No completed races yet.'
		}
	]);
</script>

{#if loading}
	<div class="mx-auto w-full max-w-7xl p-4" role="status" aria-live="polite">
		<div class="skeleton mb-4 h-8 w-64"></div>
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			<div class="skeleton h-48"></div>
			<div class="skeleton h-48"></div>
			<div class="skeleton h-48"></div>
		</div>
		<span class="sr-only">Loading races…</span>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-7xl flex-col gap-8 overflow-y-auto p-4 pb-8">
		<header>
			<h1 class="text-3xl font-bold">Races</h1>
			<p class="mt-1 opacity-70">
				Find the next start, follow live action, or revisit the results.
			</p>
		</header>

		{#each sections as section}
			<section aria-labelledby={`${section.id}-races-heading`}>
				<h2 id={`${section.id}-races-heading`} class="mb-3 text-xl font-semibold">
					{section.heading}
				</h2>
				{#if section.races.length === 0}
					<p class="rounded-box border-base-300 bg-base-200 border p-5 opacity-75">
						{section.empty}
					</p>
				{:else}
					<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each section.races as race (race.id)}
							{@const racePresentation = presentRace(race, racers, racetracks)}
							<article class="card border-base-300 bg-base-200 border shadow-sm">
								<div class="card-body gap-3">
									<div class="flex items-start justify-between gap-3">
										<div>
											<h3 class="card-title">{race.name}</h3>
											<p class="text-primary text-xs font-semibold uppercase">
												{racePresentation.formatLabel}
											</p>
											<p class="text-sm opacity-70">{racePresentation.trackName}</p>
											{#if racePresentation.trackCharacteristics}
												<p class="text-xs opacity-60">
													{racePresentation.trackCharacteristics.surfaceLabel} ·
													{racePresentation.trackCharacteristics.length.toLocaleString('en-GB')} px ·
													{racePresentation.trackCharacteristics.riskPercent}% risk
												</p>
											{/if}
										</div>
										<span class:badge-error={race.status === 'running'} class="badge badge-soft">
											{raceStatusLabel(race.status)}
										</span>
									</div>
									<p class="text-sm">{formatRaceSchedule(race.startTime, now)}</p>
									<p class="text-sm">
										{racePresentation.participantCount}
										{racePresentation.participantCount === 1 ? 'participant' : 'participants'}
										{#if racePresentation.participants.length > 0}
											<span class="opacity-70">
												· {racePresentation.participants
													.slice(0, 3)
													.map((racer) => racer.name)
													.join(', ')}</span
											>
										{/if}
									</p>
									{#if racePresentation.winnerName}
										<p><strong>Winner:</strong> {racePresentation.winnerName}</p>
									{/if}
									{#if racePresentation.results.length > 0}
										<ol class="text-sm">
											{#each racePresentation.results.slice(0, 3) as result}
												<li>{result.position}. {result.racerName}</li>
											{/each}
										</ol>
									{/if}
									<div class="card-actions mt-auto justify-end">
										<a class="btn btn-primary btn-sm" href={`/races/${race.id}`}>View race</a>
									</div>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</div>
{/if}
