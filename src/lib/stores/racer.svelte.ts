import pb from '../pocketbase';
import { type Race } from './race.svelte';
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
}

const racersKey = Symbol('racers');

export function setRacersContext() {
	const racers = $state([]);
	return setContext<Racer[]>(racersKey, racers);
}

export function getRacersContext(): Racer[] {
	return getContext<Racer[]>(racersKey);
}

export async function deleteAllRacers() {
	const racers = await pb.collection('racers').getFullList();
	for (let racer of racers) {
		await pb.collection('racers').delete(racer.id);
	}
}

export async function getRacers(raceId: string) {
	const racers = (await pb.collection('racers').getFullList({
		filter: `raceId.id = "${raceId}"`,
		expand: 'raceId.id'
	})) as Racer[];
	return racers;
}

export async function updateRacer(racerId: string, updates: Partial<Racer>) {
	await pb.collection('racers').update(racerId, updates);
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
