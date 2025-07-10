import pb from '../pocketbase';

import { v4 as uuid } from 'uuid';
import { defaultRaceTrack, type RaceTrack } from '../racetrack';
import { getContext, setContext } from 'svelte';
import type { SortedRacer } from './racer.svelte';

export interface Race {
	id?: string;
	name: string;
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled';
	racetrack: RaceTrack;
	winner: string;
	startTime: string;
	endTime: string;
	totalLaps: number;
}

export const defaultRace: Race = {
	name: `Race ${uuid().slice(0, 5)}`,
	status: 'running',
	startTime: new Date(Date.now()).toISOString(),
	totalLaps: 3,
	racetrack: defaultRaceTrack,
	winner: '',
	endTime: ''
};

const raceKey = Symbol('race');

export function setRaceContext() {
	const race = $state(defaultRace);
	return setContext<Race>(raceKey, race);
}

export function getRaceContext(): Race {
	return getContext<Race>(raceKey);
}

export async function createRace() {
	const newRace = defaultRace;
	const race = (await pb.collection('races').create(newRace)) as Race;
	return race;
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

export async function deleteAllRaces() {
	const races = await pb.collection('races').getFullList();
	for (let race of races) {
		await pb.collection('races').delete(race.id);
	}
}

export async function updateRace(id: string, updates: Partial<Race>) {
	await pb.collection('races').update(id, updates);
}
