<script lang="ts">
	import { getRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext, type Racer, type SortedRacer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';

	const racers = getRacersContext();
	const race = getRaceContext();
	const checkpoints: Record<string, { x: number; y: number }> = $derived(
		race.racetrack.checkpoints
	);

	const totalTrackLength = Object.values(checkpoints).reduce((sum, point, i) => {
		const next = race?.racetrack.checkpoints[i + 1] ||
			race?.racetrack.checkpoints[0] || { x: 0, y: 0 };
		const segmentLength = Math.hypot(next.x - point.x, next.y - point.y);
		return sum + segmentLength;
	}, 0);

	function estimateTimeBehind(racerA: Racer, racerB: Racer) {
		if (!race) return 0;
		const speedA = racerA.pokemon.speed + 50;
		const speedB = racerB.pokemon.speed + 50;

		const progressA =
			racerA.lapsCompleted * race.racetrack.totalLength + getDistanceAlongTrack(racerA);
		const progressB =
			racerB.lapsCompleted * race.racetrack.totalLength + getDistanceAlongTrack(racerB);

		const deltaDistance = progressB - progressA;

		// Average speed for better fairness
		const avgSpeed = (speedA + speedB) / 2;

		const timeBehind = deltaDistance / avgSpeed; // seconds

		return timeBehind;
	}

	function getDistanceAlongTrack(racer: Racer) {
		const current = checkpoints[racer.checkpointIndex];
		const next = checkpoints[(racer.checkpointIndex + 1) % Object.values(checkpoints).length];
		const segmentLength = Math.hypot(next.x - current.x, next.y - current.y);

		return (
			Object.values(checkpoints)
				.slice(0, racer.checkpointIndex)
				.reduce((sum, _, i) => {
					const a = checkpoints[i];
					const b = checkpoints[(i + 1) % Object.values(checkpoints).length];
					return sum + Math.hypot(b.x - a.x, b.y - a.y);
				}, 0) + Math.min(racer.distanceFromCheckpoint, segmentLength)
		);
	}

	function sortRacers() {
		const _sortedRacers = [...racers]
			.map((racer) => {
				let distance = 0;
				for (let i = 0; i < racer.checkpointIndex; i++) {
					const a = checkpoints[i];
					const b = checkpoints[i + 1] || a;
					distance += Math.hypot(b.x - a.x, b.y - a.y);
				}
				const a = checkpoints[racer.checkpointIndex];
				const b = checkpoints[racer.checkpointIndex + 1] || a;
				const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
				const t = racer.distanceFromCheckpoint / segmentLength;
				distance += segmentLength * t;

				return {
					...racer,
					progress: distance,
					totalProgress: racer.lapsCompleted * totalTrackLength + distance,
					hasBestLap:
						racer.bestLapTime ===
						Math.min(
							...racers.map((r) => {
								return r.bestLapTime === 0 || !r.bestLapTime ? Infinity : r.bestLapTime;
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

	onMount(() => {
		//sort racers in 1 second intervals
		const sortInterval = setInterval(() => {
			if (!sortDelayFinished && racers.length !== 0) {
				sortDelayFinished = true;
			} else {
				sortedRacers = sortRacers();
			}
			if (race.status === 'finished') clearInterval(sortInterval);
		}, 1000);
	});
</script>

{#if sortedRacers}
	<div
		id="leaderboard-container"
		class="bg-base-200 absolute top-[64px] left-0 h-full w-[300px] pt-20 pr-2 pl-2"
	>
		<div id="leaderboard" class="">
			<ul class="list bg-base-100 rounded-box shadow-md">
				<li class="p-4 pb-2 text-xs tracking-wide opacity-60">
					Lap {sortedRacers[0]?.lapsCompleted + 1} / {race?.totalLaps}
				</li>

				{#each sortedRacers as racer (racer.id)}
					<li class="" animate:flip={{ delay: 200 }}>
						<div
							class="list-row racer-entry grid-cols-[0.5fr_0.5fr_0.7fr_1.2fr_0.5fr] p-1 pr-3 pl-3"
						>
							<div
								class="flex h-full w-7 items-center justify-center text-xl font-thin tabular-nums opacity-30"
							>
								{sortedRacers.indexOf(racer) + 1}
							</div>
							<div class="pt-[0.1rem]">
								<img class="rounded-box size-6" src={racer.pokemon.mugshot} />
							</div>

							<div class="flex h-full items-center justify-start">
								{racer.name.substring(0, 3).toUpperCase()}
							</div>

							{#if sortedRacers.indexOf(racer) !== 0}
								<div class="flex h-full items-center justify-start">
									+{Math.abs(
										estimateTimeBehind(sortedRacers[sortedRacers.indexOf(racer) - 1], racer)
									).toFixed(3)}
								</div>
							{:else}
								<div class="flex h-full items-center justify-start">Interval</div>
							{/if}

							<div class="flex h-full items-center justify-center">
								{#if racer.finished}
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
			</ul>
		</div>
	</div>
{/if}

<style>
	.racer-img {
		-webkit-text-stroke: 1px white;
		image-rendering: crisp-edges;
	}

	.racer-entry {
		transition:
			transform 0.3s ease,
			background 0.3s ease;
	}
</style>
