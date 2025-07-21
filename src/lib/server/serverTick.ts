import {
	createRace,
	deleteAllRaces,
	getAllRaces,
	getRunningRaces,
	subscribeToRaces,
	updateRace,
	type Race
} from '$lib/stores/race.svelte';
import {
	deleteAllRacers,
	getAllRacers,
	getRacers,
	subscribeToRacers,
	updateRacer,
	type Pokemon,
	type Racer
} from '$lib/stores/racer.svelte';
import { simulateRacer } from './simulateRacer';
import { EventSource } from 'eventsource';

import { createDefaultRacers, resolveOvertaking, startLapTimer } from './serverFunctions';
import pb from '$lib/pocketbase';

//const SIM_INTERVAL = 100;
const SIM_INTERVAL = 500;

let racers: Racer[] = [];
let races: Race[] = [];

export async function startUp() {
	console.log('Starting up...');
	global.EventSource = EventSource;
	pb.collection('users').authRefresh();

	racers = await getAllRacers();
	races = await getAllRaces();

	await subscribeToRacers(racers, pb);
	await subscribeToRaces(races, pb);

	startServerTick();
}

function startServerTick() {
	setInterval(serverTick, SIM_INTERVAL);
}

async function serverTick() {
	const now = Date.now();

	// console.clear();
	// console.time('gameloop');

	for (const race of races) {
		if (race.status !== 'running') continue;

		const raceRacers = racers.filter((r) => r.race === race.id);

		let raceChanged = false;

		// Simulate racers
		await Promise.all(
			raceRacers.map(async (racer) => {
				const {
					checkpointIndex,
					distanceFromCheckpoint,
					lapsCompleted,
					lastUpdatedAt,
					x,
					y,
					finished
				} = simulateRacer(racer, race, now, race.totalLaps);

				// Update racer state
				racer.currentRace.checkpointIndex = checkpointIndex;
				racer.currentRace.distanceFromCheckpoint = distanceFromCheckpoint;
				racer.currentRace.lapsCompleted = lapsCompleted;
				racer.currentRace.lastUpdatedAt = lastUpdatedAt;
				racer.positioning.x = x;
				racer.positioning.y = y;
				racer.positioning.trackOffset = racer.positioning.targetTrackOffset ?? 0;

				// Check for winner
				if (finished && !racer.currentRace.finished) {
					racer.currentRace.finished = true;

					if (!raceRacers.some((r) => r.currentRace.finished && r.id !== racer.id)) {
						race.winner = racer.id;
						raceChanged = true;
						console.log(`🏁 Race "${race.name}" finished. Winner: ${racer.name}`);
					}
				}
			})
		);

		// Resolve overtaking
		resolveOvertaking(raceRacers, now, race);

		// If all racers finished, mark race as finished
		if (raceRacers.every((r) => r.currentRace.finished)) {
			race.status = 'finished';
			raceChanged = true;
		}

		// Batch update only racers in this race
		await Promise.all(
			raceRacers.map(async (r) => {
				if ((await updateRacer(r.id, r)) == false) racers.splice(racers.indexOf(r), 1); //remove racer from array if failed to update
			})
		);

		// Only update race if it changed
		if (raceChanged) {
			await updateRace(race.id || '0', race);
		}
	}

	// console.timeEnd('gameloop');
}
