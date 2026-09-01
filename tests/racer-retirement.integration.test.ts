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

test(
	'retirement is permanent and auditable while career and financial history survive vacancies',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-racer-retirement-'));
		const port = 18_000 + Math.floor(Math.random() * 10_000);
		const baseUrl = `http://127.0.0.1:${port}`;
		let server: ChildProcess | undefined;
		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
				serviceEmail: 'racer-retirement@example.com',
				servicePassword: 'racer-retirement-password'
			});
			const client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client
				.collection('users')
				.authWithPassword('racer-retirement@example.com', 'racer-retirement-password');

			const racerId = 'prlseedracer001';
			const before = await client.collection('racers').getOne(racerId);
			const preserved = {
				raceHistory: structuredClone(before.raceHistory),
				financials: structuredClone(before.financials),
				ownership: structuredClone(before.ownership),
				trainer: before.trainer,
				league: before.league
			};
			await client.collection('racers').update(racerId, {
				careerStartedAt: '2015-01-01T00:00:00.000Z',
				careerLoad: 280,
				traits: { ...before.traits, longevity: 20 },
				health: {
					eligible: false,
					performanceMultiplier: 1,
					activeConditionIds: ['historic-condition']
				},
				status: { retired: false, injured: true }
			});

			const request = {
				method: 'POST',
				body: {
					now: '2026-09-01T12:00:00.000Z',
					seed: 'integration-retirement',
					racerIds: [racerId]
				}
			};
			assert.deepEqual(await client.send('/api/prl/retirements/process', request), {
				retiredRacers: 1
			});
			assert.deepEqual(await client.send('/api/prl/retirements/process', request), {
				retiredRacers: 0
			});

			const retired = await client.collection('racers').getOne(racerId);
			assert.deepEqual(retired.status, { retired: true, injured: true });
			assert.equal(retired.race, '');
			assert.equal(retired.trainer, '');
			assert.equal(retired.league, '');
			assert.deepEqual(retired.raceHistory, preserved.raceHistory);
			assert.deepEqual(retired.financials, preserved.financials);
			assert.deepEqual(retired.ownership, preserved.ownership);
			assert.equal(retired.retirement.reason, 'age');
			assert.equal(retired.retirement.rulesVersion, 'racer-retirement-v1');
			assert.equal(retired.retirement.previousTrainer.id, preserved.trainer);
			assert.equal(retired.retirement.previousLeague.id, preserved.league);
			await assert.rejects(
				client.collection('racers').update(racerId, {
					status: { retired: false, injured: false },
					trainer: preserved.trainer,
					league: preserved.league
				}),
				(error: { status?: number }) => error.status === 403
			);

			const events = await client
				.collection('events')
				.getFullList({ filter: 'type = "RacerRetired"' });
			assert.equal(events.length, 1);
			assert.equal(events[0].facts.racerId, racerId);
			assert.equal(events[0].facts.previousTrainer.id, preserved.trainer);
			assert.equal(events[0].facts.previousLeague.id, preserved.league);
			assert.equal(events[0].facts.decision.inputs.careerLoad, 280);
			assert.equal(
				(await client.collection('news').getFullList({ filter: 'category = "retirement"' })).length,
				1
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
