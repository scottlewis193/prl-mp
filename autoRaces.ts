import { v4 as uuid } from 'uuid';

import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection('users').authWithPassword('sl193@pm.me', 'Drag0n1t3694793!!!');

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
			checkpointIndex: 0,
			distanceFromCheckpoint: 0,
			speed: 50 + Math.random() * 30, // varied speed
			lastUpdatedAt: new Date().toISOString()
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
