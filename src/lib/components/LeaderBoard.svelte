<script lang="ts">
	import { getCameraContext } from '$lib/stores/camera.svelte';
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getCurrentRacersContext } from '$lib/stores/racer.svelte';
	import { getCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';
	import type { Pokemon, Racer, SortedRacer } from '$lib/types';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';

	let racers = getCurrentRacersContext();
	let camera = getCameraContext();
	const race = getCurrentRaceContext();
	const racetrack = getCurrentRacetrackContext();

	const checkpoints: { index: number; x: number; y: number }[] = racetrack.checkpoints;

	const totalTrackLength = Object.values(checkpoints).reduce((sum, point, i) => {
		const next = racetrack.checkpoints[i + 1] || racetrack.checkpoints[0] || { x: 0, y: 0 };
		const segmentLength = Math.hypot(next.x - point.x, next.y - point.y);
		return sum + segmentLength;
	}, 0);

	function estimateTimeBehind(racerA: Racer, racerB: Racer) {
		if (!race) return 0;
		const pokemonA = racerA.expand.pokemon as Pokemon;
		const pokemonB = racerB.expand.pokemon as Pokemon;
		const speedA = pokemonA.speed + 50;
		const speedB = pokemonB.speed + 50;

		const progressA =
			racerA.currentRace.lapsCompleted * racetrack.totalLength + getDistanceAlongTrack(racerA);
		const progressB =
			racerB.currentRace.lapsCompleted * racetrack.totalLength + getDistanceAlongTrack(racerB);

		const deltaDistance = progressB - progressA;

		// Average speed for better fairness
		const avgSpeed = (speedA + speedB) / 2;

		const timeBehind = deltaDistance / avgSpeed; // seconds

		return timeBehind;
	}

	function getDistanceAlongTrack(racer: Racer) {
		const current = checkpoints[racer.currentRace.checkpointIndex];
		const next =
			checkpoints[(racer.currentRace.checkpointIndex + 1) % Object.values(checkpoints).length];
		const segmentLength = Math.hypot(next.x - current.x, next.y - current.y);

		return (
			Object.values(checkpoints)
				.slice(0, racer.currentRace.checkpointIndex)
				.reduce((sum, _, i) => {
					const a = checkpoints[i];
					const b = checkpoints[(i + 1) % Object.values(checkpoints).length];
					return sum + Math.hypot(b.x - a.x, b.y - a.y);
				}, 0) + Math.min(racer.currentRace.distanceFromCheckpoint, segmentLength)
		);
	}

	function sortRacers() {
		const _sortedRacers = [...racers]
			.map((racer) => {
				let distance = 0;
				for (let i = 0; i < racer.currentRace.checkpointIndex; i++) {
					const a = checkpoints[i];
					const b = checkpoints[i + 1] || a;
					distance += Math.hypot(b.x - a.x, b.y - a.y);
				}
				const a = checkpoints[racer.currentRace.checkpointIndex];
				const b = checkpoints[racer.currentRace.checkpointIndex + 1] || a;
				const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
				const t = racer.currentRace.distanceFromCheckpoint / segmentLength;
				distance += segmentLength * t;

				return {
					...racer,
					progress: distance,
					totalProgress: racer.currentRace.lapsCompleted * totalTrackLength + distance,
					hasBestLap:
						racer.currentRace.bestLapTime ===
						Math.min(
							...racers.map((r) => {
								return r.currentRace.bestLapTime === 0 || !r.currentRace.bestLapTime
									? Infinity
									: r.currentRace.bestLapTime;
							})
						)
				};
			})
			.sort((a, b) => b.totalProgress - a.totalProgress);
		return _sortedRacers;
	}

	let sortInterval: NodeJS.Timeout;
	let sortDelayFinished: boolean = false;
	let sortedRacers: SortedRacer[] = $state([]);
	let mode: 'Interval' | 'Leader' = $state('Interval');

	onMount(() => {
		//sort racers in 1 second intervals
		const sortInterval = setInterval(() => {
			sortedRacers = sortRacers();
		}, 1000);
	});
</script>

{#if sortedRacers.length > 0}
	<div
		id="leaderboard-container"
		class="absolute top-2 left-2 z-[1000] flex h-full flex-col gap-2 select-none"
	>
		<button
			class="btn btn-primary w-15"
			onclick={(e) => {
				e.currentTarget?.parentElement?.children[1].classList.toggle('hidden');
			}}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h8m-8 6h16"
				/>
			</svg>
		</button>
		<div id="leaderboard" class="hidden w-[300px]">
			<ul class="list bg-base-200 rounded-box shadow-md">
				<li class="p-4 pb-2 text-xs tracking-wide opacity-60">
					Lap {sortedRacers[0]?.currentRace.lapsCompleted + 1} / {race?.totalLaps}
				</li>

				{#each sortedRacers as racer (racer.id)}
					{@const pokemon = racer.expand.pokemon as Pokemon}
					<li
						class="cursor-pointer"
						onclick={() => {
							camera.mode = 'follow';
							camera.targetRacerId = racer.id || '0';
						}}
						animate:flip={{ delay: 200 }}
					>
						<div
							class="list-row racer-entry grid-cols-[0.5fr_0.5fr_0.7fr_1.2fr_0.5fr] p-1 pr-3 pl-3"
						>
							<div
								class="flex h-full w-7 items-center justify-center text-xl font-thin tabular-nums opacity-30"
							>
								{sortedRacers.indexOf(racer) + 1}
							</div>
							<div class="pt-[0.1rem]">
								<img class="rounded-box size-6" src={pokemon.mugshot} alt="pokemon-sprite" />
							</div>

							<div class="flex h-full items-center justify-start">
								{racer.name.substring(0, 3).toUpperCase()}
							</div>

							{#if sortedRacers.indexOf(racer) !== 0}
								<div class="flex h-full items-center justify-start">
									+{Math.abs(
										mode == 'Interval'
											? estimateTimeBehind(sortedRacers[sortedRacers.indexOf(racer) - 1], racer)
											: estimateTimeBehind(sortedRacers[0], racer)
									).toFixed(3)}
								</div>
							{:else}
								<div class="flex h-full items-center justify-start">{mode}</div>
							{/if}

							<div class="flex h-full items-center justify-center">
								{#if racer.currentRace.finished}
									<svg
										width="25"
										height="25"
										class="rounded-field"
										viewBox="0 0 64 64"
										xmlns="http://www.w3.org/2000/svg"
									>
										<rect width="64" height="64" fill="white" />
										<g fill="black">
											<!-- First row -->
											<rect x="0" y="0" width="16" height="16" />
											<rect x="32" y="0" width="16" height="16" />

											<!-- Second row -->
											<rect x="16" y="16" width="16" height="16" />
											<rect x="48" y="16" width="16" height="16" />

											<!-- Third row -->
											<rect x="0" y="32" width="16" height="16" />
											<rect x="32" y="32" width="16" height="16" />

											<!-- Fourth row -->
											<rect x="16" y="48" width="16" height="16" />
											<rect x="48" y="48" width="16" height="16" />
										</g>
									</svg>
								{:else if racer.hasBestLap}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="25"
										height="25"
										fill="currentColor"
										class="bi bi-stopwatch rounded-field bg-purple-500 p-1"
										viewBox="0 0 16 16"
									>
										<path d="M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5z" />
										<path
											d="M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64l.012-.013.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5M8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3"
										/>
									</svg>
								{:else}
									<div></div>
								{/if}
							</div>
						</div>
					</li>
				{/each}
				<div class="flex items-center justify-center gap-2 p-2">
					Interval
					<input
						type="checkbox"
						class="toggle toggle-xs mt-[0.5px]"
						onchange={(event) => {
							const target = event.target as HTMLInputElement;
							mode = target.checked ? 'Leader' : 'Interval';
						}}
					/>
					Leader
				</div>
			</ul>
		</div>
	</div>
{/if}

<style>
	.racer-entry {
		transition:
			transform 0.3s ease,
			background 0.3s ease;
	}
</style>
