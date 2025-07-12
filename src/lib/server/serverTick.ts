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

const SIM_INTERVAL = 100;

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

	serverTick();
}

let lastUpdate = Date.now();

async function serverTick() {
	const glInterval = setInterval(async () => {
		// races = await getRunningRaces();
		const now = Date.now();

		const dt = (now - lastUpdate) / 1000; // in seconds
		lastUpdate = now;

		// now use `dt` to simulate racer progress
		// console.clear();
		// console.time('gameloop');

		//simulate racers and assign results directly
		for (const race of races) {
			if (race.status !== 'running') continue;
			const raceRacers = racers.filter((racer) => racer.raceId == race.id);
			for (const racer of raceRacers) {
				const result = simulateRacer(racer, race, now, race.totalLaps);
				racer.checkpointIndex = result.checkpointIndex;
				racer.distanceFromCheckpoint = result.distanceFromCheckpoint;
				racer.lapsCompleted = result.lapsCompleted;
				racer.lastUpdatedAt = result.lastUpdatedAt;

				//check if racer has finished
				if (result.finished) {
					//check if first racer to finish
					if (!racers.some((r) => r.finished)) {
						await updateRace(race.id || '0', {
							winner: racer.id
						});
						console.log(`🏁 Race "${race.name}" finished. Winner: ${racer?.name}`);
					}
					racer.finished = true;
				}
			}

			//Resolve overtaking using computed results
			resolveOvertaking(racers, now, race);

			//set status to finished if all racers have finished
			if (racers.every((r) => r.finished)) {
				await updateRace(race.id || '0', {
					status: 'finished'
				});
			}

			//batch update db

			await Promise.all(
				racers.map((racer) => {
					const racersRace = races.find((r) => r.id === racer.raceId);
					if (racersRace?.status === 'pending') return;
					racer.trackOffset = racer.targetTrackOffset ?? 0;
					// if (racer.finished) console.log(racer.finished);
					return updateRacer(racer.id, racer);
				})
			);
		}

		// console.timeEnd('gameloop');
		// console.clear();
		// console.log('Races:', races.length, 'Racers:', racers.length);
	}, SIM_INTERVAL);
}
