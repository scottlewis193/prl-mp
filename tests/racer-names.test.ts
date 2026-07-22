import assert from 'node:assert/strict';
import test from 'node:test';

import { female, male } from '../src/lib/server/static/names';
import { selectRacerGender, selectRacerName } from '../src/lib/server/racerNames';

test('selects a random name from the racer gender list', () => {
	assert.equal(selectRacerName('female', () => 0), female[0]);
	assert.equal(selectRacerName('male', () => 0), male[0]);
});

test('randomises the racer gender independently of the trainer', () => {
	assert.equal(selectRacerGender(() => 0.49), 'male');
	assert.equal(selectRacerGender(() => 0.5), 'female');
});
