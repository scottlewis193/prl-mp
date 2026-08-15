import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribeToRaceDiscovery } from '../src/lib/raceDiscoveryUpdates';
import type { Race, Racer } from '../src/lib/types';

test('an already-open discovery view receives race status and participant changes', async () => {
	const callbacks = new Map<string, (event: any) => void>();
	const unsubscribed: string[] = [];
	const pb = {
		collection(name: string) {
			return {
				subscribe: async (_topic: string, callback: (event: any) => void) => {
					callbacks.set(name, callback);
					return () => unsubscribed.push(name);
				}
			};
		}
	};
	const races = [{ id: 'race-1', status: 'pending', name: 'Indigo Cup' }] as Race[];
	const racers = [{ id: 'racer-1', name: 'Bolt', race: '' }] as Racer[];
	const stop = await subscribeToRaceDiscovery(pb as never, { races, racers });

	callbacks.get('races')?.({
		action: 'update',
		record: { id: 'race-1', status: 'running', name: 'Indigo Cup' }
	});
	callbacks.get('racers')?.({
		action: 'update',
		record: { id: 'racer-1', name: 'Bolt', race: 'race-1' }
	});

	assert.equal(races[0].status, 'running');
	assert.equal(racers[0].race, 'race-1');
	await stop();
	assert.deepEqual(unsubscribed.sort(), ['racers', 'races']);
});

test('a deleted race is removed without accidentally deleting another race', async () => {
	const callbacks = new Map<string, (event: any) => void>();
	let deletedId = '';
	const pb = {
		collection(name: string) {
			return {
				subscribe: async (_topic: string, callback: (event: any) => void) => {
					callbacks.set(name, callback);
					return () => undefined;
				}
			};
		}
	};
	const races = [
		{ id: 'race-1', status: 'pending' },
		{ id: 'race-2', status: 'pending' }
	] as Race[];

	await subscribeToRaceDiscovery(pb as never, {
		races,
		racers: [],
		onRaceDeleted: (id) => (deletedId = id)
	});
	callbacks.get('races')?.({ action: 'delete', record: { id: 'missing' } });
	assert.deepEqual(
		races.map((race) => race.id),
		['race-1', 'race-2']
	);

	callbacks.get('races')?.({ action: 'delete', record: { id: 'race-1' } });
	assert.deepEqual(
		races.map((race) => race.id),
		['race-2']
	);
	assert.equal(deletedId, 'race-1');
});
