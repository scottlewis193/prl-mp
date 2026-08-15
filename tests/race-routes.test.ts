import assert from 'node:assert/strict';
import test from 'node:test';

import { load as loadRaceIndex } from '../src/routes/races/+page.server';
import { load as loadRaceDetail } from '../src/routes/races/[id]/+page.server';

function locals(records: Record<string, unknown>) {
	return {
		pb: {
			collection(name: string) {
				return {
					getFullList: async () => records[name],
					getOne: async (id: string) => {
						const value = records[`${name}:${id}`];
						if (value instanceof Error) throw value;
						return value;
					}
				};
			}
		}
	};
}

test('race discovery server load returns races with participant and track lookup data', async () => {
	const races = [{ id: 'race-1', name: 'Indigo Cup' }];
	const racers = [{ id: 'racer-1', name: 'Bolt', race: 'race-1' }];
	const racetracks = [{ id: 'track-1', name: 'Indigo Circuit' }];

	const result = await loadRaceIndex({
		locals: locals({ races, racers, racetracks })
	} as never);

	assert.deepEqual(result, { races, racers, racetracks });
});

test('direct race navigation loads its own race, track and participants', async () => {
	const race = {
		id: 'race-1',
		name: 'Indigo Cup',
		racetrack: 'track-1',
		finishingOrder: ['racer-2', 'racer-1']
	};
	const racers = [
		{ id: 'racer-1', name: 'Bolt', race: '' },
		{ id: 'racer-2', name: 'Dash', race: '' }
	];
	const racetrack = { id: 'track-1', name: 'Indigo Circuit' };

	const result = await loadRaceDetail({
		params: { id: 'race-1' },
		locals: locals({ 'races:race-1': race, racers, 'racetracks:track-1': racetrack })
	} as never);

	assert.deepEqual(result, { race, racers, racetrack });
});

test('direct race navigation returns a clear 404 for a missing or deleted race', async () => {
	const missing = Object.assign(new Error('Missing'), { status: 404 });

	await assert.rejects(
		() =>
			loadRaceDetail({
				params: { id: 'deleted-race' },
				locals: locals({ 'races:deleted-race': missing })
			} as never),
		(error: { status?: number; body?: { message?: string } }) => {
			assert.equal(error.status, 404);
			assert.match(error.body?.message ?? '', /race not found/i);
			return true;
		}
	);
});
