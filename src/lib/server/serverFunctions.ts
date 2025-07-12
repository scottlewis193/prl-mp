import { defaultRace, type Race } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';
import { createRandomPokemon } from './pokemon';
import pb from '../pocketbase';

export function startLapTimer(racers: Racer[]) {
	for (const racer of racers) {
		//init lap timer
		if (!racer.lapStartTime) {
			racer.lapStartTime = Date.now() / 1000;
		}
	}
}

export function recordLapTime(racer: Racer, lapNumber: number) {
	if (!racer.lapStartTime) {
		return;
	}
	const lapTime = Number((Date.now() / 1000 - racer.lapStartTime).toFixed(3));

	racer.lapTimes[lapNumber] = lapTime;
	racer.bestLapTime =
		racer.bestLapTime !== undefined && racer.bestLapTime !== 0
			? Math.min(racer.bestLapTime, lapTime)
			: lapTime;
	racer.lapStartTime = undefined;
}

export function resolveOvertaking(racers: Racer[], now: number, race: Race) {
	const laneSpacing = 0.4; // adjust as needed
	const cooldown = 1000;

	// Available lane offsets (5 lanes: -2 to +2)
	const possibleLanes = [-2, -1, 0, 1, 2].map((i) => i * laneSpacing);

	// Sort racers by progress
	const sorted = [...racers].sort(
		(a, b) =>
			b.lapsCompleted - a.lapsCompleted ||
			b.checkpointIndex - a.checkpointIndex ||
			b.distanceFromCheckpoint - a.distanceFromCheckpoint
	);

	// Track lane usage per segment
	const laneReservations = new Map<string, Set<number>>();

	function getOccupiedLanes(segmentKey: string): Set<number> {
		if (!laneReservations.has(segmentKey)) {
			laneReservations.set(segmentKey, new Set());
		}
		return laneReservations.get(segmentKey)!;
	}

	// Assign each racer to a lane
	for (let i = 0; i < sorted.length; i++) {
		const racer = sorted[i];

		const nextCheckpoint =
			(racer.checkpointIndex + 1) % Object.values(race.racetrack.checkpoints).length;
		const segmentKey = `${racer.lapsCompleted}-${racer.checkpointIndex}-${nextCheckpoint}`;
		const occupiedLanes = getOccupiedLanes(segmentKey);

		// If cooldown expired or never set, try to assign a lane
		if (!racer.lastOffsetChangeAt || now - racer.lastOffsetChangeAt > cooldown) {
			// If already close to another racer, find a clear lane
			let laneFound = false;

			for (let j = 0; j < i; j++) {
				const ahead = sorted[j];
				if (ahead.checkpointIndex !== racer.checkpointIndex) continue;

				const gap = Math.abs(ahead.distanceFromCheckpoint - racer.distanceFromCheckpoint);
				if (gap < 60) {
					// Racer is close to someone ahead — try to dodge
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.targetTrackOffset = lane;
							racer.lastOffsetChangeAt = now;
							occupiedLanes.add(lane);
							laneFound = true;
							break;
						}
					}
					break; // only check first nearby ahead racer
				}
			}

			if (!laneFound) {
				// Not near anyone — try to stay or return to center
				if (!occupiedLanes.has(0)) {
					racer.targetTrackOffset = 0;
					occupiedLanes.add(0);
				} else {
					// Center lane blocked, pick any free
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.targetTrackOffset = lane;
							occupiedLanes.add(lane);
							break;
						}
					}
				}
			}
		} else {
			// Lane is locked by cooldown — re-reserve it
			occupiedLanes.add(racer.targetTrackOffset ?? 0);
		}
	}
}

export async function createDefaultRacers(race: Race) {
	for (let i = 0; i < 20; i++) {
		const newPokemon = await createRandomPokemon();
		const newRacer: Partial<Racer> = {
			pokemon: newPokemon,
			name: newPokemon.name,
			raceId: race.id,
			checkpointIndex: 0,
			distanceFromCheckpoint: 0,
			lastUpdatedAt: new Date().toISOString(),
			lapTimes: {}
		};

		await pb.collection('racers').create(newRacer);
	}
}

export async function createRace() {
	const race = (await pb.collection('races').create(defaultRace)) as Race;
	await createDefaultRacers(race);
	return race;
}
