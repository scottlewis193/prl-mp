import { Race } from '$lib/types';
import pb from './pocketbase';
import { getRacers, getUnassignedRacers, updateRacer } from './racers';
import { deleteAllRecords } from './recordDeletion';
export async function createRace() {
	const newRace = new Race();
	const race = (await pb.collection('races').create(newRace)) as Race;
	if (!race.id) {
		throw new Error('PocketBase created a race without an ID');
	}

	const unassignedRacers = await getUnassignedRacers();
	const assignments = await Promise.all(
		unassignedRacers.map((racer) =>
			updateRacer(racer.id || '0', {
				race: race.id,
				currentRace: {
					...racer.currentRace,
					trainerAtEntry: racer.trainer
						? { status: 'attributed', trainerId: racer.trainer }
						: { status: 'untrained' },
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lapsCompleted: 0,
					lastUpdatedAt: '',
					finished: false,
					finishedAt: undefined,
					lapStartTime: undefined,
					lapTimes: {},
					bestLapTime: undefined
				}
			})
		)
	);

	return { race, racerCount: assignments.filter(Boolean).length };
}

export async function getRace(id: string) {
	const race = (await pb.collection('races').getOne(id)) as Race;
	return race;
}

export async function getFirstRace() {
	const race = (await pb.collection('races').getFirstListItem('')) as Race;
	return race;
}

export async function getRunningRaces() {
	return (await pb.collection('races').getFullList({
		filter: 'status = "running"'
	})) as Race[];
}

export async function getFinishedRaces() {
	return (await pb.collection('races').getFullList({
		filter: 'status = "finished"'
	})) as Race[];
}

export async function settleRace(raceId: string): Promise<boolean> {
	const response = (await pb.send('/api/prl/races/settle', {
		method: 'POST',
		body: { raceId }
	})) as { settled: boolean };

	return response.settled;
}

export async function getAllRaces() {
	return (await pb.collection('races').getFullList()) as Race[];
}

export async function deleteAllRaces() {
	await deleteAllRecords(pb.collection('races'));
}

export async function updateRace(id: string, updates: Partial<Race>): Promise<boolean> {
	try {
		await pb.collection('races').update(id, updates);
		return true;
	} catch (error) {
		console.log('error updating race:', id);
		return false;
	}
}

export async function startRace(raceId: string, startedAt = new Date()): Promise<boolean> {
	const lastUpdatedAt = startedAt.toISOString();
	const raceRacers = await getRacers(raceId);
	if (raceRacers.length === 0) {
		return false;
	}

	const racerUpdates = await Promise.all(
		raceRacers.map((racer) =>
			updateRacer(racer.id || '0', {
				currentRace: {
					...racer.currentRace,
					lastUpdatedAt,
					finished: false,
					finishedAt: undefined
				}
			})
		)
	);
	if (racerUpdates.some((updated) => !updated)) {
		throw new Error(`Failed to prepare every racer for race ${raceId}`);
	}

	if (!(await updateRace(raceId, { status: 'running', startTime: startedAt }))) {
		throw new Error(`Failed to mark race ${raceId} as running`);
	}
	return true;
}
