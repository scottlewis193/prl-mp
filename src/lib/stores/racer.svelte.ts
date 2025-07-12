import pb from '../pocketbase';
import PocketBase from 'pocketbase';

import { getContext, setContext } from 'svelte';

export interface Racer {
	id: string;
	name: string;
	raceId: string;
	lapsCompleted: number;
	checkpointIndex: number;
	distanceFromCheckpoint: number;
	lastUpdatedAt: string;
	speed: number;
	finished: boolean;
	pokemon: Pokemon;
	trackOffset?: number;
	targetTrackOffset: number;
	lastOffsetChangeAt?: number;
	lapStartTime?: number;
	lapTimes: { [lapNumber: number]: number };
	bestLapTime?: number;
}

export type SortedRacer = Racer & { progress: number; totalProgress: number; hasBestLap: boolean };

const racersKey = Symbol('racers');

export function setRacersContext(racers: Racer[] = []) {
	const _racers = $state(racers);
	return setContext<Racer[]>(racersKey, _racers);
}

export function getRacersContext(): Racer[] {
	return getContext<Racer[]>(racersKey);
}

export async function deleteAllRacers() {
	console.log(pb.authStore.isValid);
	const racersToDelete = await pb.collection('racers').getFullList();

	for (let racer of racersToDelete) {
		await pb.collection('racers').delete(racer.id);
	}
}

export async function getAllRacers() {
	return (await pb.collection('racers').getFullList()) as Racer[];
}

export async function getRacers(raceId: string) {
	return (await pb.collection('racers').getFullList({
		filter: `raceId.id = "${raceId}"`,
		expand: 'raceId.id'
	})) as Racer[];
}

export async function updateRacer(racerId: string, updates: Partial<Racer>) {
	try {
		await pb.collection('racers').update(racerId, updates);
	} catch (error) {
		console.log('Error updating racer:', racerId);
	}
}

export async function updateRacersByRaceId(raceId: string, updates: Partial<Racer>) {
	const racers = await getRacers(raceId);

	await Promise.all(
		racers.map((racer) => {
			racer = { ...racer, ...updates };
			return updateRacer(racer.id, racer);
		})
	);
}

export interface Pokemon {
	id: number;
	name: string;
	mugshot: string;
	spriteSheet: string;
	types: string[];
	hp: number;
	attack: number;
	defense: number;
	speed: number;
}

export async function subscribeToRacers(racersAry: Racer[], pb: PocketBase) {
	await pb.collection('racers').subscribe('*', async function (e) {
		const racerRecord = e.record as unknown as Racer;
		switch (e.action) {
			case 'create':
				racersAry.push(racerRecord);
				break;
			case 'update':
				const index = racersAry.findIndex((r) => r.id === racerRecord.id);
				if (index !== -1) {
					racersAry[index] = racerRecord;
				} else {
					racersAry.push(racerRecord);
				}
				break;
			case 'delete':
				racersAry.splice(
					racersAry.findIndex((r) => r.id === racerRecord.id),
					1
				);
				break;
		}
	});
}
