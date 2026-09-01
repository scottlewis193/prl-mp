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

const serviceEmail = 'legends-exhibition@example.com';
const servicePassword = 'legends-exhibition-password';

test(
	'a Legends Exhibition admits only invited retired racers and settles without reactivating them',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-legends-exhibition-'));
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
			const activeRacers = await client.collection('racers').getFullList({
				filter: `league = "${leagueId}"`,
				sort: 'id'
			});
			await Promise.all(
				activeRacers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			await client.collection('races').update('prlseedrace0001', {
				status: 'settled',
				league: null
			});

			const legends = activeRacers.slice(0, 2);
			for (const legend of legends) {
				await client.collection('racers').update(legend.id, {
					careerStartedAt: '2010-01-01T00:00:00.000Z',
					careerLoad: 500,
					traits: { ...legend.traits, longevity: 1 },
					health: {
						eligible: false,
						performanceMultiplier: 1,
						activeConditionIds: ['historic-condition']
					}
				});
			}
			assert.deepEqual(
				await client.send('/api/prl/retirements/process', {
					method: 'POST',
					body: {
						now: '2026-09-01T12:00:00.000Z',
						seed: 'legends-exhibition-retirements',
						racerIds: legends.map((racer) => racer.id)
					}
				}),
				{ retiredRacers: 2 }
			);

			await assert.rejects(
				client.send('/api/prl/races/legends/schedule', {
					method: 'POST',
					body: {
						requestKey: 'invalid-active-legend',
						leagueId,
						startTime: '2026-09-02T12:00:00.000Z',
						racerIds: [legends[0].id, activeRacers[2].id]
					}
				}),
				/only retired racers are eligible/i
			);

			const standingsBefore = JSON.stringify(
				await client.collection('leagueStandings').getFullList({ sort: 'id' })
			);
			const before = await Promise.all(
				legends.map((legend) => client.collection('racers').getOne(legend.id))
			);
			const scheduled = await client.send<{
				raceId: string;
				eventId: string;
				created: boolean;
			}>('/api/prl/races/legends/schedule', {
				method: 'POST',
				body: {
					requestKey: 'legends-exhibition-integration',
					leagueId,
					startTime: '2026-09-02T12:00:00.000Z',
					racerIds: legends.map((racer) => racer.id),
					totalLaps: 3,
					prizeScale: 0.1,
					wageringEnabled: false,
					schedulingSeed: 'legends-integration-seed'
				}
			});
			const race = await client.collection('races').getOne(scheduled.raceId);
			const entrants = await client.collection('racers').getFullList({
				filter: `race = "${race.id}"`,
				sort: 'id'
			});

			assert.deepEqual(
				entrants.map((racer) => racer.id),
				legends.map((racer) => racer.id).sort()
			);
			assert.deepEqual(race.raceFormat, {
				type: 'legends_exhibition',
				ranked: false,
				rulesVersion: 'legends-exhibition-v1'
			});
			assert.deepEqual(race.eligibilityPolicy, {
				activeOnly: false,
				healthEligible: false,
				leagueId,
				retired: true,
				trainerRequired: false
			});
			assert.deepEqual(race.pointsCurve, []);
			assert.deepEqual(race.prizeCurve, [0.2, 0.1]);
			assert.equal(race.prizeScale, 0.1);
			assert.deepEqual(race.movePolicy, {
				enabled: false,
				rulesVersion: 'moves-disabled-v1'
			});
			assert.deepEqual(race.riskPolicy, {
				level: 'low',
				incidentMultiplier: 0.25,
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
						idempotencyKey: 'disabled-legends-wager'
					}
				}),
				/unavailable for this race format/i
			);
			assert.deepEqual(
				await client.send('/api/prl/races/legends/schedule', {
					method: 'POST',
					body: {
						requestKey: 'legends-exhibition-integration',
						leagueId,
						startTime: '2026-09-02T12:00:00.000Z',
						racerIds: legends.map((racer) => racer.id),
						totalLaps: 3,
						prizeScale: 0.1,
						wageringEnabled: false,
						schedulingSeed: 'legends-integration-seed'
					}
				}),
				{ ...scheduled, created: false }
			);
			for (let index = 0; index < entrants.length; index += 1) {
				assert.equal(entrants[index].status.retired, true);
				assert.equal(entrants[index].trainer, '');
				assert.equal(entrants[index].league, '');
				assert.deepEqual(entrants[index].retirement, before[index].retirement);
			}

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

			const pricesBefore = new Map(
				entrants.map((racer) => [racer.id, racer.financials.currentSharePrice])
			);
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
				JSON.stringify(await client.collection('leagueStandings').getFullList({ sort: 'id' })),
				standingsBefore
			);
			const settledRace = await client.collection('races').getOne(race.id);
			assert.equal(settledRace.status, 'settled');
			assert.equal(settledRace.raceFormat.type, 'legends_exhibition');
			const settledEntrants = await Promise.all(
				entrants.map((racer) => client.collection('racers').getOne(racer.id))
			);
			for (const racer of settledEntrants) {
				assert.equal(racer.status.retired, true);
				assert.equal(racer.race, '');
				assert.equal(racer.trainer, '');
				assert.equal(racer.league, '');
				assert.notEqual(racer.financials.currentSharePrice, pricesBefore.get(racer.id));
			}
			const settlementEvent = await client
				.collection('events')
				.getFirstListItem(`idempotencyKey = "race-settled:${race.id}"`);
			assert.equal(settlementEvent.facts.raceFormat.type, 'legends_exhibition');
			assert.equal(settlementEvent.facts.priceMovements.length, 2);
			const story = await client.collection('news').getFirstListItem(`race = "${race.id}"`);
			assert.match(`${story.headline} ${story.summary}`, /Legends Exhibition/i);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
