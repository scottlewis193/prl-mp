import type { Race, Racer } from './types';
import type PocketBase from 'pocketbase';

type RecordAction = 'create' | 'update' | 'delete';
type RealtimeEvent<T> = { action: RecordAction; record: T };
type RaceDiscoveryState = {
	races: Race[];
	racers: Racer[];
	onRaceDeleted?: (id: string) => void;
};

function applyRecord<T extends { id?: string }>(records: T[], event: RealtimeEvent<T>): void {
	const index = records.findIndex((record) => record.id === event.record.id);
	if (event.action === 'delete') {
		if (index >= 0) records.splice(index, 1);
		return;
	}
	if (index >= 0) Object.assign(records[index], event.record);
	else records.push(event.record);
}

function isRecordAction(action: string): action is RecordAction {
	return action === 'create' || action === 'update' || action === 'delete';
}

export async function subscribeToRaceDiscovery(
	pb: PocketBase,
	state: RaceDiscoveryState
): Promise<() => Promise<void>> {
	const [stopRaces, stopRacers] = await Promise.all([
		pb.collection<Race>('races').subscribe('*', (event) => {
			if (!isRecordAction(event.action)) return;
			applyRecord(state.races, { action: event.action, record: event.record });
			if (event.action === 'delete' && event.record.id) state.onRaceDeleted?.(event.record.id);
		}),
		pb.collection<Racer>('racers').subscribe('*', (event) => {
			if (!isRecordAction(event.action)) return;
			applyRecord(state.racers, { action: event.action, record: event.record });
		})
	]);

	return async () => {
		await Promise.all([stopRaces(), stopRacers()]);
	};
}
