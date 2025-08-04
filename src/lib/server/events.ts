import type { EventType } from '$lib/types';
import pb from './pocketbase';

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
