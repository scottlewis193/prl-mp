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

const serviceEmail = 'race-incidents@example.com';
const servicePassword = 'race-incidents-password';

test(
	'an all-DNF commit durably records health consequences and voids the winner market at settlement',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-race-incidents-'));
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

			const raceId = 'prlseedrace0001';
			const entrants = await client.collection('racers').getFullList({
				filter: `race = "${raceId}"`,
				sort: 'id'
			});
			const racers = entrants.slice(0, 2);
			await Promise.all(
				entrants
					.slice(2)
					.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			const cutoff = new Date(Date.now() + 60_000).toISOString();
			await client.collection('races').update(raceId, {
				status: 'pending',
				bettingCutoff: cutoff,
				markets: {
					winnerType: 'winner',
					winnerName: 'Race winner',
					winnerCutoff: cutoff,
					winnerSelections: racers.map((racer) => ({ racerId: racer.id, odds: 2 }))
				}
			});
			await client.send('/api/prl/wagers/place', {
				method: 'POST',
				body: {
					raceId,
					market: 'winner',
					selection: racers[0].id,
					stake: 10,
					idempotencyKey: 'all-dnf-wager'
				}
			});
			await client.collection('races').update(raceId, { status: 'running' });

			const lease = (await client.send('/api/prl/simulator/lease', {
				method: 'POST',
				body: { ownerId: 'incident-worker', ttlMs: 5_000 }
			})) as { acquired: boolean; token: number };
			assert.equal(lease.acquired, true);
			const occurredAt = '2026-09-01T16:00:00.000Z';
			const nonFinishers = racers.map((racer, index) => ({
				racerId: racer.id,
				reason: index === 0 ? 'oil-slick' : 'mechanical-failure',
				summary: `${racer.name} did not finish after an incident.`,
				occurredAt
			}));
			const racerUpdates = racers.map((racer, index) => {
				const incident = {
					eventId: `${raceId}:${racer.id}:0:3:dnf`,
					type: index === 0 ? 'crash' : 'mechanical',
					cause: nonFinishers[index].reason,
					summary: nonFinishers[index].summary,
					occurredAt,
					healthSeverity: index === 0 ? 'severe' : 'moderate',
					decisionRoll: 0.01,
					probability: 0.2,
					rulesVersion: 'race-incidents-v1'
				};
				return {
					id: racer.id,
					currentRace: {
						...racer.currentRace,
						finished: true,
						outcome: 'dnf',
						finishedAt: occurredAt,
						incident
					},
					positioning: racer.positioning,
					stats: racer.stats,
					health: {
						eligible: false,
						performanceMultiplier: 0,
						activeConditionIds: [incident.eventId]
					},
					status: { ...racer.status, injured: true }
				};
			});
			let commitResult;
			try {
				commitResult = await client.send('/api/prl/simulator/commit', {
					method: 'POST',
					body: {
						ownerId: 'incident-worker',
						token: lease.token,
						racerUpdates,
						raceUpdate: {
							id: raceId,
							status: 'finished',
							winner: '',
							endTime: occurredAt,
							finishingOrder: [],
							nonFinishers
						}
					}
				});
			} catch (error) {
				throw new Error(JSON.stringify(error));
			}
			assert.deepEqual(commitResult, { committed: true });
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId }
				}),
				{ settled: true }
			);

			const settledRace = await client.collection('races').getOne(raceId);
			assert.equal(settledRace.winner, '');
			assert.deepEqual(settledRace.finishingOrder, []);
			assert.deepEqual(settledRace.nonFinishers, nonFinishers);
			assert.deepEqual(
				(await client.collection('wagers').getFullList()).map((wager) => ({
					status: wager.status,
					payout: wager.payout
				})),
				[{ status: 'refunded', payout: 10 }]
			);
			const conditions = await client.collection('healthConditions').getFullList({ sort: 'racer' });
			assert.equal(conditions.length, 2);
			assert.ok(conditions.every((condition) => condition.cause === 'race_incident'));
			assert.ok(conditions.every((condition) => condition.eligibilityEffect === 'ineligible'));
			const persistedRacers = await Promise.all(
				racers.map((racer) => client.collection('racers').getOne(racer.id))
			);
			assert.ok(persistedRacers.every((racer) => racer.health.eligible === false));
			assert.deepEqual(
				persistedRacers.map((racer) => racer.raceHistory.races.at(-1)?.outcome),
				['dnf', 'dnf']
			);
			const settlementEvent = await client
				.collection('events')
				.getFirstListItem(`idempotencyKey = "race-settled:${raceId}"`);
			assert.deepEqual(settlementEvent.facts.winnerMarket, { outcome: 'void', winnerId: '' });
			const story = (await client.collection('news').getFullList()).at(-1);
			assert.match(story?.headline ?? '', /no classified finisher/i);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
