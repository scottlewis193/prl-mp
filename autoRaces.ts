import { v4 as uuid } from 'uuid';

import 'dotenv/config';
import PocketBase from 'pocketbase';
import { resolvePocketBaseUrl } from './src/lib/pocketbase-url.js';

const pbUrl = resolvePocketBaseUrl(process.env.PUBLIC_PB_URL);
const pbUser = process.env.PB_USER;
const pbPass = process.env.PB_PASS;

if (!pbUser || !pbPass) throw new Error('PB_USER and PB_PASS must be configured');

const pb = new PocketBase(pbUrl);
await pb.collection('users').authWithPassword(pbUser, pbPass);

// globally disable auto cancellation
pb.autoCancellation(false);

const CREATE_INTERVAL_MS = 60 * 1000; // 1 minute
const COUNTDOWN_DELAY_MS = 5 * 1000;

async function createRaceIfNeeded() {
	try {
		const existingPending = await pb.collection('races').getFirstListItem('status = "pending"');
		if (existingPending) return; // already exists
	} catch (error) {}

	const newRace = await pb.collection('races').create({
		name: `Race ${uuid().slice(0, 5)}`,
		status: 'pending',
		startTime: new Date(Date.now() + COUNTDOWN_DELAY_MS).toISOString()
	});

	// Create racers for this race
	const racerNames = ['Comet', 'Blaze', 'Drift', 'Flash', 'Nova'];
	for (let name of racerNames) {
		await pb.collection('racers').create({
			name,
			race: newRace.id,
			stats: {
				hp: 0,
				attack: 0,
				defense: 0,
				speed: 50 + Math.random() * 30,
				level: 1,
				ranking: 0,
				gender: 'male'
			},
			status: { retired: false, injured: false },
			currentRace: {
				lapsCompleted: 0,
				checkpointIndex: 0,
				distanceFromCheckpoint: 0,
				lastUpdatedAt: new Date().toISOString(),
				finished: false,
				lapTimes: {}
			},
			raceHistory: { wins: 0, totalRaces: 0, averageFinishPosition: 0, races: [] },
			positioning: { x: 0, y: 0, targetTrackOffset: 0 },
			ownership: { totalShares: 0, shareholders: [] },
			financials: {
				totalEarnings: 0,
				earningsPerShare: 0,
				issuedShares: 0,
				outstandingShares: 0,
				currentSharePrice: 0,
				priceHistory: []
			}
		});
	}

	console.log(`Race ${newRace.name} created.`);
}

async function startCountdowns() {
	const pending = await pb.collection('races').getFullList({
		filter: 'status = "pending"'
	});

	for (let race of pending) {
		await pb.collection('races').update(race.id, {
			status: 'countdown',
			startTime: new Date(Date.now() + COUNTDOWN_DELAY_MS).toISOString()
		});

		// Schedule start
		setTimeout(async () => {
			await pb.collection('races').update(race.id, {
				status: 'running'
			});
			console.log(`Race ${race.name} is now running.`);
		}, COUNTDOWN_DELAY_MS);
	}
}

await createRaceIfNeeded();
await startCountdowns();

setInterval(async () => {
	await createRaceIfNeeded();
	await startCountdowns();
}, CREATE_INTERVAL_MS);
