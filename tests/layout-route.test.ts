import assert from 'node:assert/strict';
import test from 'node:test';

import { load } from '../src/routes/+layout.server';

test('the server layout supplies shared race data on an initial page request', async () => {
	const records = {
		races: [{ id: 'race-1', name: 'Indigo Cup' }],
		racers: [{ id: 'racer-1', name: 'Bolt' }],
		racetracks: [{ id: 'track-1', name: 'Indigo Circuit' }]
	};
	const calls: Array<{ collection: string; options: unknown }> = [];
	const result = await load({
		locals: {
			user: { id: 'user-1' },
			pb: {
				collection(collection: keyof typeof records) {
					return {
						async getFullList(options: unknown) {
							calls.push({ collection, options });
							return records[collection];
						}
					};
				}
			}
		},
		url: new URL('http://localhost/exchange')
	} as never);

	assert.deepEqual(result, {
		user: { id: 'user-1' },
		url: '/exchange',
		races: records.races,
		racers: records.racers,
		racetracks: records.racetracks
	});
	assert.deepEqual(
		calls.map(({ collection }) => collection),
		['races', 'racers', 'racetracks']
	);
});
