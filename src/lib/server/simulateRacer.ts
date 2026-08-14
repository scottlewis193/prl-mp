import type { Racer, RaceTrack } from '$lib/types';
import { recordLapTime, startLapTimer } from './lapTiming';

const collisionThreshold = 64; // collision radius

export function simulateRacer(
	racer: Racer,
	racetrack: RaceTrack,
	now = Date.now(),
	totalLaps = 10
) {
	const lastUpdatedAt = Date.parse(racer.currentRace.lastUpdatedAt);
	const elapsed = Number.isFinite(lastUpdatedAt) ? Math.max(0, (now - lastUpdatedAt) / 1000) : 0;

	// Determine current speed
	const pokemon = racer.expand.pokemon;
	if (!pokemon) {
		return {
			checkpointIndex: 0,
			distanceFromCheckpoint: 0,
			lapsCompleted: 0,
			lastUpdatedAt: new Date(now).toISOString(),
			finished: true,
			x: 0,
			y: 0
		};
	}
	const speed = racer.currentRace.finished ? pokemon.speed / 7 : pokemon.speed + racer.stats.speed;

	// Total distance to travel this tick
	let distanceToTravel = racer.currentRace.distanceFromCheckpoint + speed * elapsed;

	let checkpointIndex = racer.currentRace.checkpointIndex;
	let lapsCompleted = racer.currentRace.lapsCompleted;

	const checkpoints = racetrack.checkpoints;
	const trackWidth = racetrack.width || 64;

	// Move through segments as needed
	while (distanceToTravel > 0) {
		const a = checkpoints[checkpointIndex];
		const b = checkpoints[(checkpointIndex + 1) % Object.values(checkpoints).length];
		const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);

		// Still on current segment
		if (distanceToTravel < segmentLength) {
			break;
		}

		distanceToTravel -= segmentLength;
		checkpointIndex++;
		racer.stats.speed = Math.floor(Math.random() * 5);

		// Wrap checkpoints and count laps
		if (checkpointIndex >= Object.values(checkpoints).length - 1) {
			checkpointIndex = 0;
			lapsCompleted++;

			recordLapTime(racer, lapsCompleted);
			startLapTimer([racer]);

			if (lapsCompleted >= totalLaps) {
				return {
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lapsCompleted,
					lastUpdatedAt: new Date(now).toISOString(),
					finished: true,
					x: checkpoints[0].x,
					y: checkpoints[0].y
				};
			}
		}
	}

	// Compute exact position on segment
	const a = checkpoints[checkpointIndex];
	const b = checkpoints[(checkpointIndex + 1) % Object.values(checkpoints).length];

	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const segmentLength = Math.hypot(dx, dy);
	const t = Math.min(distanceToTravel / segmentLength, 1);

	// Centerline position
	const cx = a.x + dx * t;
	const cy = a.y + dy * t;

	// Lane offset
	const nx = -dy / segmentLength;
	const ny = dx / segmentLength;
	const offset = ((racer.positioning.trackOffset ?? 0) * trackWidth) / 2;

	const x = cx + nx * offset;
	const y = cy + ny * offset;

	return {
		checkpointIndex,
		distanceFromCheckpoint: distanceToTravel,
		lapsCompleted,
		lastUpdatedAt: new Date(now).toISOString(),
		finished: false,
		x,
		y
	};
}
