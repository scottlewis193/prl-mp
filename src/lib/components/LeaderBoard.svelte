<script lang="ts">
	import { getCameraContext } from '$lib/stores/camera.svelte';
	import { getRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext, type Racer } from '$lib/stores/racer.svelte';

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

	let leaderboard: Racer[] = $state([]);
	$effect(() => {
		leaderboard = [...racers]
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
					totalProgress: racer.lapsCompleted * totalTrackLength + distance
				};
			})
			.sort((a, b) => b.totalProgress - a.totalProgress);
	});
</script>

<div
	id="leaderboard-container"
	class="bg-base-100 absolute top-0 left-0 z-[1000] h-full w-[220px] pt-20"
>
	<div id="leaderboard" class="z-[1000]">
		<ul class="list bg-base-100 rounded-box shadow-md">
			<li class="p-4 pb-2 text-xs tracking-wide opacity-60">
				Lap {leaderboard[0]?.lapsCompleted + 1} / {race?.totalLaps}
			</li>

			{#each leaderboard as racer, i}
				<li class="list-row p-1 pr-3 pl-3">
					<div
						class="flex h-full w-7 items-center justify-center text-xl font-thin tabular-nums opacity-30"
					>
						{i + 1}
					</div>
					<div class="pt-[0.1rem]">
						<img class="rounded-box size-6" src={racer.pokemon.mugshot} />
					</div>

					<div class="flex h-full items-center justify-center">
						{racer.name.substring(0, 3).toUpperCase()}
					</div>

					<div class="list-col-grow">
						{#if i !== 0}
							<div class="flex h-full items-center justify-center">
								+{Math.abs(estimateTimeBehind(leaderboard[i - 1], racer)).toFixed(3)}
							</div>
						{:else}
							<div class="flex h-full items-center justify-center">-</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.racer-img {
		-webkit-text-stroke: 1px white;
		image-rendering: crisp-edges;
	}
</style>
