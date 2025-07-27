import type { Race } from './race.svelte';
import PocketBase from 'pocketbase';
import pb from '../pocketbase';

export type EventType = {
	id: string;
	type: 'DailyLeagueRaces';
	startTime: Date;
	raceIds: string[];
	started: boolean;
	finished: boolean;
};

export async function getAllEvents() {
	return (await pb.collection('events').getFullList()) as EventType[];
}

export async function updateEvent(id: string, updates: Partial<EventType>) {
	try {
		await pb.collection('events').update(id, updates);
	} catch (error) {
		console.log('error updating event:', id);
	}
}

export async function subscribeToEvents(eventAry: EventType[], pb: PocketBase) {
	await pb.collection('events').unsubscribe();
	await pb.collection('events').subscribe('*', async function (e) {
		const eventRecord = e.record as unknown as EventType;
		switch (e.action) {
			case 'create':
				eventAry.push(eventRecord);
				break;
			case 'update':
				const index = eventAry.findIndex((r) => r.id === eventRecord.id);
				if (index !== -1) {
					eventAry[index] = eventRecord;
				} else {
					eventAry.push(eventRecord);
				}
				break;
			case 'delete':
				eventAry.splice(
					eventAry.findIndex((r) => r.id === eventRecord.id),
					1
				);
				break;
		}
	});
}
