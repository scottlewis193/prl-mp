import {
	createRace,
	deleteAllRaces,
	getAllRaces,
	getRunningRaces,
	subscribeToRaces,
	updateRace,
	type Race,
	type RaceType
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

import { create5DayLeagueEvents, resolveOvertaking, startLapTimer } from './serverFunctions';
import pb from './pocketbase';
import {
	getAllEvents,
	subscribeToEvents,
	updateEvent,
	type EventType
} from '$lib/stores/event.svelte';
import { subscribeToUsers, type User } from '$lib/stores/user.svelte';
import { getAllRacetracks, RaceTrack } from '$lib/stores/racetrack.svelte';

//const SIM_INTERVAL = 100;
const SIM_INTERVAL = 500;

let racers: Racer[] = [];
let races: Race[] = [];
let events: EventType[] = [];
let users: User[] = [];
let racetracks: RaceTrack[] = [];

export async function startUp() {
	console.log('Starting up...');
	global.EventSource = EventSource;
	pb.collection('users').authRefresh();

	racers = await getAllRacers();
	races = await getAllRaces();
	events = await getAllEvents();
	racetracks = await getAllRacetracks();

	await subscribeToRacers(racers, pb);
	await subscribeToRaces(races, pb);
	await subscribeToEvents(events, pb);
	await subscribeToUsers(users, pb);

	startServerTick();
}

function startServerTick() {
	setInterval(serverTick, SIM_INTERVAL);
}

async function serverTick() {
	const now = Date.now();

	// console.clear();
	// console.time('gameloop');

	await simulateRaces();
	// await simulateEvents();
	// await simulateMarkets();
	// console.timeEnd('gameloop');
}

async function simulateRaces() {
	for (const race of races) {
		if (race.status !== 'running') continue;

		const raceRacers = racers.filter((r) => r.race === race.id);
		const racetrack = racetracks.find((track) => track.id === race.racetrack) || racetracks[0];

		let raceChanged = false;
		const now = Date.now();

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
						race.winner = racer?.id || '0';
						raceChanged = true;
						console.log(`🏁 Race "${race.name}" finished. Winner: ${racer.name}`);
					}
				}
			})
		);

		// Resolve overtaking
		resolveOvertaking(raceRacers, now, race, racetrack);

		// If all racers finished, mark race as finished
		if (raceRacers.every((r) => r.currentRace.finished)) {
			race.status = 'finished';
			raceChanged = true;
		}

		// Batch update only racers in this race
		await Promise.all(
			raceRacers.map(async (r) => {
				if ((await updateRacer(r?.id || '0', r)) == false) racers.splice(racers.indexOf(r), 1); //remove racer from array if failed to update
			})
		);

		// Only update race if it changed
		if (raceChanged) {
			await updateRace(race.id || '0', race);
		}
	}
}

//this will start events (all races within events) if they have not started yet and past the start time
// and ends them if every race within the event has finished
async function simulateEvents() {
	const now = Date.now();
	for (const event of events) {
		if (!event.started && event.startTime.getUTCMilliseconds() <= now) {
			event.started = true;
			const eventRaces = races.filter((r) => event.raceIds.includes(r.id || '0'));

			await Promise.all(
				eventRaces.map(async (race) => {
					//update races which have not started yet and past the start time
					if (race.status == 'pending' && race.startTime.getUTCMilliseconds() <= now) {
						await updateRace(race.id || '0', { status: 'running', startTime: new Date() });
					}
				})
			);

			//update event status if all races within the event have finished
			if (eventRaces.every((r) => r.status == 'finished')) {
				await updateEvent(event.id || '0', { finished: true });
			}
		}
	}

	//if all DailyLeagueRace type events have finished, generate new ones for the next five days
	if (events.every((e) => e.finished && e.type == 'DailyLeagueRaces')) {
		await create5DayLeagueEvents();
	}
}

async function simulateMarkets() {
	// const fakeUsers = users.filter((user) => user.isFake);
	// for (const racer of racers) {
	// 	const actions = simulateInvestorActions(racer, fakeUsers);
	// 	for (const action of actions) {
	// 		if (action.type === 'buy') {
	// 			await buyShares(racer, action.investor, action.amount);
	// 		} else if (action.type === 'sell') {
	// 			await sellShares(racer, action.investor, action.amount);
	// 		}
	// 	}
	// 	// Recalculate share price based on updated demand
	// 	const newPrice = calculateSharePrice(racer);
	// 	await pb.collection('pokemon').update(racer.id, {
	// 		share_price: newPrice
	// 	});
	// }
}
