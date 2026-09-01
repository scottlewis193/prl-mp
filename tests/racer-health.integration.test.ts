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

const serviceEmail = 'racer-health@example.com';
const servicePassword = 'racer-health-password';

test(
	'world health processing records onset and recovery consequences exactly once',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-racer-health-'));
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

			const racerId = 'prlseedracer001';
			const before = await client.collection('racers').getOne(racerId);
			const careerHistory = structuredClone(before.raceHistory);
			const priorPricePoint = {
				timestamp: '2026-08-01T12:00:00.000Z',
				price: 12.5,
				reason: 'opening market'
			};
			await client.collection('pokemon').update(before.pokemon, { hp: 45 });
			await client.collection('racers').update(racerId, {
				traits: { ...before.traits, durability: 20, resilience: 30 },
				careerStartedAt: '2025-07-08T12:00:00.000Z',
				careerLoad: 32,
				financials: {
					...before.financials,
					currentSharePrice: 12.5,
					priceHistory: [...before.financials.priceHistory, priorPricePoint]
				},
				raceHistory: careerHistory,
				race: null
			});
			const allRacers = await client.collection('racers').getFullList();
			await Promise.all(
				allRacers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			await client.collection('races').update('prlseedrace0001', {
				status: 'settled',
				league: null
			});
			const scheduleRequest = {
				method: 'POST',
				body: {
					now: '2026-09-01T11:00:00.000Z',
					futureEventCount: 1,
					eventIntervalMs: 24 * 60 * 60 * 1000,
					scheduleOffsetMs: 14 * 60 * 60 * 1000
				}
			};
			await client.send('/api/prl/schedule/reconcile', scheduleRequest);
			assert.notEqual((await client.collection('racers').getOne(racerId)).race, '');

			const onsetRequest = {
				method: 'POST',
				body: {
					now: '2026-09-01T12:00:00.000Z',
					seed: 'integration-1',
					trackRisk: 0.7,
					eventRisk: 0.4,
					racerIds: [racerId]
				}
			};
			assert.deepEqual(await client.send('/api/prl/health/process', onsetRequest), {
				createdConditions: 1,
				recoveredConditions: 0
			});
			assert.deepEqual(await client.send('/api/prl/health/process', onsetRequest), {
				createdConditions: 0,
				recoveredConditions: 0
			});

			const [condition] = await client.collection('healthConditions').getFullList();
			assert.equal(condition.racer, racerId);
			assert.equal(condition.kind, 'injury');
			assert.equal(condition.severity, 'moderate');
			assert.equal(condition.cause, 'track_incident');
			assert.match(condition.onsetAt, /^2026-09-01/);
			assert.match(condition.expectedRecoveryAt, /^2026-09-10/);
			assert.equal(condition.recoveredAt, '');
			assert.equal(condition.eligibilityEffect, 'ineligible');
			assert.equal(condition.rulesVersion, 'racer-health-v1');
			assert.equal(condition.roll, 0.02818);
			assert.deepEqual(condition.inputs, {
				speciesHp: 45,
				durability: 20,
				resilience: 30,
				ageDays: 420,
				careerLoad: 32,
				activeConditionCount: 0,
				trackRisk: 0.7,
				eventRisk: 0.4
			});

			const during = await client.collection('racers').getOne(racerId);
			assert.deepEqual(during.health, {
				eligible: false,
				performanceMultiplier: 1,
				activeConditionIds: [condition.id]
			});
			assert.equal(during.status.injured, true);
			assert.deepEqual(during.raceHistory, careerHistory);
			assert.equal(during.financials.priceHistory.at(-2).reason, 'opening market');
			assert.equal(during.financials.priceHistory.at(-1).reason.type, 'health');
			assert.equal(during.financials.priceHistory.at(-1).reason.transition, 'onset');
			assert.equal(during.financials.currentSharePrice, 11.5);
			await client.send('/api/prl/schedule/reconcile', {
				...scheduleRequest,
				body: { ...scheduleRequest.body, now: '2026-09-01T12:00:00.000Z' }
			});
			assert.equal((await client.collection('racers').getOne(racerId)).race, '');
			assert.ok(
				(await client.collection('racers').getFullList({ filter: 'race != ""' })).length > 0
			);

			const onsetEvent = await client.collection('events').getFirstListItem(`type = "HealthOnset"`);
			assert.equal(onsetEvent.facts.conditionId, condition.id);
			assert.equal(onsetEvent.facts.racerId, racerId);
			const onsetNews = await client
				.collection('news')
				.getFirstListItem(`sourceEvent = "${onsetEvent.id}"`);
			assert.equal(onsetNews.category, 'health_onset');
			assert.match(`${onsetNews.headline} ${onsetNews.summary}`, new RegExp(before.name));
			assert.ok(
				onsetNews.links.some(
					(link: { kind: string; id: string }) => link.kind === 'racer' && link.id === racerId
				)
			);

			const recoveryRequest = {
				method: 'POST',
				body: {
					now: condition.expectedRecoveryAt,
					seed: 'recovery-day',
					racerIds: [racerId]
				}
			};
			assert.deepEqual(await client.send('/api/prl/health/process', recoveryRequest), {
				createdConditions: 0,
				recoveredConditions: 1
			});
			assert.deepEqual(await client.send('/api/prl/health/process', recoveryRequest), {
				createdConditions: 0,
				recoveredConditions: 0
			});

			const recoveredCondition = await client.collection('healthConditions').getOne(condition.id);
			assert.match(recoveredCondition.recoveredAt, /^2026-09-10/);
			const recoveredRacer = await client.collection('racers').getOne(racerId);
			assert.deepEqual(recoveredRacer.health, {
				eligible: true,
				performanceMultiplier: 1,
				activeConditionIds: []
			});
			assert.equal(recoveredRacer.status.injured, false);
			assert.deepEqual(recoveredRacer.raceHistory, careerHistory);
			assert.equal(
				recoveredRacer.financials.priceHistory.length,
				during.financials.priceHistory.length + 1
			);
			assert.equal(recoveredRacer.financials.priceHistory.at(-1).reason.transition, 'recovery');
			assert.equal(
				(await client.collection('events').getFullList({ filter: `type = "HealthRecovery"` }))
					.length,
				1
			);
			assert.equal(
				(await client.collection('news').getFullList({ filter: `category = "health_recovery"` }))
					.length,
				1
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
