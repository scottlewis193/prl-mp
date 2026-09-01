import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { NodePocketBase } from './support/node-pocketbase';
import {
	projectDirectory,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const serviceEmail = 'exhibition-race@example.com';
const servicePassword = 'exhibition-race-password';

test(
	'an Exhibition Race snapshots its lower-stakes policy, admits eligible racers, and settles unranked',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-exhibition-race-'));
		const port = 18_000 + Math.floor(Math.random() * 10_000);
		const baseUrl = `http://127.0.0.1:${port}`;
		let server: ChildProcess | undefined;
		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
				serviceEmail,
				servicePassword
			});
			const client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);

			const leagueId = 'prlseeddemo0001';
			const racers = await client.collection('racers').getFullList({
				filter: `league = "${leagueId}"`,
				sort: 'id'
			});
			await Promise.all(
				racers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			await client.collection('races').update('prlseedrace0001', {
				status: 'settled',
				league: null
			});
			const ineligible = racers.at(-1);
			assert.ok(ineligible);
			await client.collection('racers').update(ineligible.id, {
				health: { ...ineligible.health, eligible: false, activeConditionIds: ['condition-1'] }
			});
			const standingsBefore = JSON.stringify(
				await client.collection('leagueStandings').getFullList({
					filter: `league = "${leagueId}"`,
					sort: 'id'
				})
			);

			const scheduled = await client.send<{ raceId: string }>(
				'/api/prl/races/exhibitions/schedule',
				{
					method: 'POST',
					body: {
						requestKey: 'exhibition-race-integration',
						leagueId,
						startTime: '2026-09-02T12:00:00.000Z',
						entrantCount: 3,
						totalLaps: 3,
						prizeScale: 0.25,
						wageringEnabled: false,
						schedulingSeed: 'exhibition-integration-seed'
					}
				}
			);
			const race = await client.collection('races').getOne(scheduled.raceId);
			const entrants = await client.collection('racers').getFullList({
				filter: `race = "${race.id}"`,
				sort: 'id'
			});

			assert.equal(entrants.length, 3);
			assert.equal(
				entrants.some((racer) => racer.id === ineligible.id),
				false
			);
			assert.deepEqual(race.raceFormat, {
				type: 'exhibition',
				ranked: false,
				rulesVersion: 'exhibition-race-v1'
			});
			assert.deepEqual(race.eligibilityPolicy, {
				activeOnly: true,
				healthEligible: true,
				leagueId,
				retired: false,
				trainerRequired: true
			});
			assert.deepEqual(race.pointsCurve, []);
			assert.deepEqual(race.prizeCurve, [0.75, 0.5, 0.25]);
			assert.equal(race.prizeScale, 0.25);
			assert.deepEqual(race.movePolicy, {
				enabled: false,
				rulesVersion: 'moves-disabled-v1'
			});
			assert.deepEqual(race.riskPolicy, {
				level: 'low',
				incidentMultiplier: 0.5,
				trackRisk: (await client.collection('racetracks').getOne(race.racetrack)).risk
			});
			assert.deepEqual(race.wageringPolicy, { enabled: false, markets: [] });
			assert.deepEqual(race.markets ?? {}, {});
			await assert.rejects(
				client.send('/api/prl/wagers/place', {
					method: 'POST',
					body: {
						raceId: race.id,
						market: 'winner',
						selection: entrants[0].id,
						stake: 1,
						idempotencyKey: 'disabled-exhibition-wager'
					}
				}),
				/unavailable for this race format/i
			);

			await client.send('/api/prl/schedule/reconcile', {
				method: 'POST',
				body: {
					now: '2026-09-02T12:00:00.000Z',
					futureEventCount: 1,
					eventIntervalMs: 60 * 60 * 1000,
					scheduleOffsetMs: 0
				}
			});
			assert.equal((await client.collection('races').getOne(race.id)).status, 'running');

			await Promise.all(
				entrants.map((racer, index) =>
					client.collection('racers').update(racer.id, {
						currentRace: {
							...racer.currentRace,
							finished: true,
							finishedAt: new Date(
								Date.parse('2026-09-02T12:30:00.000Z') + index * 1000
							).toISOString()
						}
					})
				)
			);
			await client.collection('races').update(race.id, { status: 'finished' });
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId: race.id }
				}),
				{ settled: true }
			);

			assert.equal(
				JSON.stringify(
					await client.collection('leagueStandings').getFullList({
						filter: `league = "${leagueId}"`,
						sort: 'id'
					})
				),
				standingsBefore
			);
			const settledRace = await client.collection('races').getOne(race.id);
			assert.equal(settledRace.status, 'settled');
			assert.equal(settledRace.raceFormat.type, 'exhibition');
			const settlementEvent = await client
				.collection('events')
				.getFirstListItem(`idempotencyKey = "race-settled:${race.id}"`);
			assert.equal(settlementEvent.facts.raceFormat.type, 'exhibition');
			const story = await client.collection('news').getFirstListItem(`race = "${race.id}"`);
			assert.match(`${story.headline} ${story.summary}`, /Exhibition Race/i);

			const wagered = await client.send<{ raceId: string; created: boolean }>(
				'/api/prl/races/exhibitions/schedule',
				{
					method: 'POST',
					body: {
						requestKey: 'wagered-exhibition',
						leagueId,
						startTime: '2026-09-03T12:00:00.000Z',
						entrantCount: 2,
						wageringEnabled: true
					}
				}
			);
			const wageredRace = await client.collection('races').getOne(wagered.raceId);
			assert.deepEqual(wageredRace.wageringPolicy, { enabled: true, markets: ['winner'] });
			assert.equal(wageredRace.markets.winnerType, 'winner');
			assert.equal(wageredRace.markets.winnerSelections.length, 2);
			assert.deepEqual(
				await client.send('/api/prl/races/exhibitions/schedule', {
					method: 'POST',
					body: {
						requestKey: 'wagered-exhibition',
						leagueId,
						startTime: '2026-09-03T12:00:00.000Z',
						entrantCount: 2,
						wageringEnabled: true
					}
				}),
				{ ...wagered, created: false }
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
