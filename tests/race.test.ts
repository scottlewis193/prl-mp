import assert from 'node:assert/strict';
import test from 'node:test';

import { Race } from '../src/lib/types';

test('new races have a name accepted by the PocketBase schema', () => {
	assert.notEqual(new Race().name.trim(), '');
});

test('new races leave ID generation to PocketBase', () => {
	assert.equal(new Race().id, undefined);
});

test('new races carry an explicit default format policy snapshot', () => {
	const race = new Race();

	assert.deepEqual(race.raceFormat, {
		type: 'league_race',
		ranked: true,
		rulesVersion: 'league-race-v1'
	});
	assert.deepEqual(race.eligibilityPolicy, {
		activeOnly: true,
		healthEligible: true,
		leagueId: '',
		retired: false,
		trainerRequired: true
	});
	assert.deepEqual(race.pointsCurve, []);
	assert.deepEqual(race.prizeCurve, []);
	assert.deepEqual(race.movePolicy, { enabled: true, rulesVersion: 'racing-moves-v1' });
	assert.deepEqual(race.riskPolicy, {
		level: 'standard',
		incidentMultiplier: 1,
		trackRisk: 0
	});
	assert.deepEqual(race.wageringPolicy, { enabled: false, markets: [] });
});
