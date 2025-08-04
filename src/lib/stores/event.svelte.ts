import type { EventType, Race } from '../types';
import PocketBase from 'pocketbase';
import pb from '../pocketbase';

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
