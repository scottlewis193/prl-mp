import type { Race } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';

const collisionThreshold = 64; // collision radius

export function simulateRacer(racer: Racer, race: Race, now = Date.now(), totalLaps = 3) {
	const elapsed = (now - new Date(racer.lastUpdatedAt).getTime()) / 1000;
	const speed = racer.pokemon.speed + 25 + Math.random() * 50;
	let distanceToTravel = racer.distanceFromCheckpoint + speed * elapsed;

	let checkpointIndex = racer.checkpointIndex;
	let lapsCompleted = racer.lapsCompleted;

	while (distanceToTravel > 0) {
		const current = race.racetrack.checkpoints[checkpointIndex];
		const next =
			race.racetrack.checkpoints[
				(checkpointIndex + 1) % Object.values(race.racetrack.checkpoints).length
			];
		const segmentLength = Math.hypot(next.x - current.x, next.y - current.y);

		//still on segment (between checkpoints)
		if (distanceToTravel < segmentLength) {
			return {
				checkpointIndex,
				distanceFromCheckpoint: distanceToTravel,
				lapsCompleted,
				lastUpdatedAt: new Date(now).toISOString(),
				finished: false
			};
		}
		//has finished segment
		distanceToTravel -= segmentLength;
		checkpointIndex++;

		// Finished last checkpoint? Loop back and count lap
		if (checkpointIndex >= Object.values(race.racetrack.checkpoints).length - 1) {
			checkpointIndex = 0;
			lapsCompleted++;

			if (lapsCompleted >= totalLaps) {
				return {
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lapsCompleted,
					lastUpdatedAt: new Date(now).toISOString(),
					finished: true
				};
			}
		}
	}

	return {
		checkpointIndex,
		distanceFromCheckpoint: distanceToTravel,
		lapsCompleted,
		lastUpdatedAt: new Date(now).toISOString(),
		finished: false
	};
}

function checkCollisions(positions: { x: number; y: number; id: string }[]) {
	const collisions: [string, string][] = [];

	for (let i = 0; i < positions.length; i++) {
		for (let j = i + 1; j < positions.length; j++) {
			const a = positions[i];
			const b = positions[j];

			const dist = Math.hypot(b.x - a.x, b.y - a.y);

			if (dist < collisionThreshold) {
				collisions.push([a.id, b.id]);
			}
		}
	}

	return collisions;
}
