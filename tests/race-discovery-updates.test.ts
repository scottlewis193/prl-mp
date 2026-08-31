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

test('realtime topics are connected sequentially', async () => {
	let activeSubscriptions = 0;
	let maximumActiveSubscriptions = 0;
	const pb = {
		collection() {
			return {
				subscribe: async () => {
					activeSubscriptions += 1;
					maximumActiveSubscriptions = Math.max(maximumActiveSubscriptions, activeSubscriptions);
					await Promise.resolve();
					activeSubscriptions -= 1;
					return () => undefined;
				}
			};
		}
	};

	await subscribeToRaceDiscovery(pb as never, { races: [], racers: [] });

	assert.equal(maximumActiveSubscriptions, 1);
});

test('a live race racer update advances the rendered movement target', async () => {
	const callbacks = new Map<string, (event: any) => void>();
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
	const racers = [
		{
			id: 'racer-1',
			positioning: { x: 10, y: 20, targetTrackOffset: 0 },
			_displayX: 12,
			_displayY: 22,
			_lastTargetX: 10,
			_lastTargetY: 20,
			_targetX: 15,
			_targetY: 25,
			_interpStartTime: 0,
			_interpDuration: 500
		}
	] as Racer[];

	await subscribeToRaceDiscovery(pb as never, { races: [], racers });
	callbacks.get('racers')?.({
		action: 'update',
		record: {
			id: 'racer-1',
			positioning: { x: 100, y: 200, targetTrackOffset: 0 }
		}
	});

	assert.equal(racers[0]._lastTargetX, 12);
	assert.equal(racers[0]._lastTargetY, 22);
	assert.equal(racers[0]._targetX, 100);
	assert.equal(racers[0]._targetY, 200);
	assert.ok(racers[0]._interpStartTime > 0);
});
