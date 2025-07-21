import { Race } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';
import { createRandomPokemon } from './pokemon';
import pb from '../pocketbase';

export function startLapTimer(racers: Racer[]) {
	for (const racer of racers) {
		//init lap timer
		if (!racer.currentRace.lapStartTime) {
			racer.currentRace.lapStartTime = Date.now() / 1000;
		}
	}
}

export function recordLapTime(racer: Racer, lapNumber: number) {
	if (!racer.currentRace.lapStartTime) {
		return;
	}
	const lapTime = Number((Date.now() / 1000 - racer.currentRace.lapStartTime).toFixed(3));

	racer.currentRace.lapTimes[lapNumber] = lapTime;
	racer.currentRace.bestLapTime =
		racer.currentRace.bestLapTime !== undefined && racer.currentRace.bestLapTime !== 0
			? Math.min(racer.currentRace.bestLapTime, lapTime)
			: lapTime;
	racer.currentRace.lapStartTime = undefined;
}

export function resolveOvertaking(racers: Racer[], now: number, race: Race) {
	const laneSpacing = 0.4; // adjust as needed
	const cooldown = 1000;

	// Available lane offsets (5 lanes: -2 to +2)
	const possibleLanes = [-2, -1, 0, 1, 2].map((i) => i * laneSpacing);

	// Sort racers by progress
	const sorted = [...racers].sort(
		(a, b) =>
			b.currentRace.lapsCompleted - a.currentRace.lapsCompleted ||
			b.currentRace.checkpointIndex - a.currentRace.checkpointIndex ||
			b.currentRace.distanceFromCheckpoint - a.currentRace.distanceFromCheckpoint
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
			(racer.currentRace.checkpointIndex + 1) % Object.values(race.racetrack.checkpoints).length;
		const segmentKey = `${racer.currentRace.lapsCompleted}-${racer.currentRace.checkpointIndex}-${nextCheckpoint}`;
		const occupiedLanes = getOccupiedLanes(segmentKey);

		// If cooldown expired or never set, try to assign a lane
		if (
			!racer.positioning.lastOffsetChangeAt ||
			now - racer.positioning.lastOffsetChangeAt > cooldown
		) {
			// If already close to another racer, find a clear lane
			let laneFound = false;

			for (let j = 0; j < i; j++) {
				const ahead = sorted[j];
				if (ahead.currentRace.checkpointIndex !== racer.currentRace.checkpointIndex) continue;

				const gap = Math.abs(
					ahead.currentRace.distanceFromCheckpoint - racer.currentRace.distanceFromCheckpoint
				);
				if (gap < 60) {
					// Racer is close to someone ahead — try to dodge
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.positioning.targetTrackOffset = lane;
							racer.positioning.lastOffsetChangeAt = now;
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
					racer.positioning.targetTrackOffset = 0;
					occupiedLanes.add(0);
				} else {
					// Center lane blocked, pick any free
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.positioning.targetTrackOffset = lane;
							occupiedLanes.add(lane);
							break;
						}
					}
				}
			}
		} else {
			// Lane is locked by cooldown — re-reserve it
			occupiedLanes.add(racer.positioning.targetTrackOffset ?? 0);
		}
	}
}

export async function createDefaultRacers(race: Race) {
	for (let i = 0; i < 20; i++) {
		const newPokemon = await createRandomPokemon();
		const newRacer: Partial<Racer> = {
			pokemon: newPokemon,
			name: newPokemon.name,
			race: race.id
		};

		await pb.collection('racers').create(newRacer);
	}
}

export async function createRace() {
	const race = (await pb
		.collection('races')
		.create(JSON.parse(JSON.stringify(new Race())))) as Race;
	await createDefaultRacers(race);
	return race;
}
