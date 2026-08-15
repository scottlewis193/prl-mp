import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from '../src/routes/trainers/+page.server';

test('trainer route exposes careers and expanded recent race results', async () => {
	const trainers = [{ id: 'trainer-1', name: 'Misty', career: { starts: 1 } }];
	const results = [{ id: 'result-1', trainer: 'trainer-1', expand: { racer: {}, race: {} } }];
	const calls: Array<{ name: string; options: unknown }> = [];
	const loaded = await load({
		locals: {
			pb: {
				collection(name: string) {
					return {
						getFullList: async (options: unknown) => {
							calls.push({ name, options });
							return name === 'trainers' ? trainers : results;
						}
					};
				}
			}
		}
	} as never);

	assert.deepEqual(loaded, { trainers, results });
	assert.deepEqual(calls, [
		{ name: 'trainers', options: { sort: 'name' } },
		{
			name: 'trainerRaceResults',
			options: { sort: '-occurredAt', expand: 'racer,race', batch: 500 }
		}
	]);
});
