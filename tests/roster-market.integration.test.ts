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
	'roster processing signs, replaces, values and replenishes racers exactly once',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-roster-market-'));
		const port = 18_000 + Math.floor(Math.random() * 10_000);
		const baseUrl = `http://127.0.0.1:${port}`;
		let server: ChildProcess | undefined;
		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
				serviceEmail: 'roster-market@example.com',
				servicePassword: 'roster-market-password'
			});
			const client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client
				.collection('users')
				.authWithPassword('roster-market@example.com', 'roster-market-password');
			const sendRosterRequest = async (label: string, request: object) => {
				try {
					return await client.send('/api/prl/rosters/process', request);
				} catch (error) {
					throw new Error(
						`${label}: ${JSON.stringify((error as { response?: unknown }).response)}`
					);
				}
			};

			const rosterRacer = await client.collection('racers').getOne('prlseedracer001');
			const firstFreeAgent = await client.collection('racers').getOne('prlseedracer002');
			const trainerId = rosterRacer.trainer as string;
			const originalRosterIds = new Set(
				(await client.collection('racers').getFullList({ filter: `trainer = "${trainerId}"` })).map(
					({ id }) => id
				)
			);
			await client.collection('trainers').update(trainerId, { budget: 1000, rosterCapacity: 4 });
			await client.collection('racers').update(firstFreeAgent.id, {
				race: null,
				trainer: null,
				league: null
			});

			const firstRequest = {
				method: 'POST',
				body: {
					now: '2026-09-01T12:00:00.000Z',
					seed: 'integration-roster-day-1',
					trainerIds: [trainerId],
					minimumPoolSize: 0,
					targetPoolSize: 0
				}
			};
			assert.deepEqual(await sendRosterRequest('sign', firstRequest), {
				signedRacers: 1,
				releasedRacers: 0,
				createdFreeAgents: 0
			});
			assert.deepEqual(await sendRosterRequest('repeat sign', firstRequest), {
				signedRacers: 0,
				releasedRacers: 0,
				createdFreeAgents: 0
			});

			const signed = (
				await client.collection('racers').getFullList({ filter: `trainer = "${trainerId}"` })
			).find(({ id }) => !originalRosterIds.has(id));
			assert.ok(signed);
			assert.equal(signed.trainer, trainerId);
			assert.equal(signed.league, rosterRacer.league);
			assert.equal(signed.financials.priceHistory.at(-1).reason.type, 'roster_change');
			assert.equal(signed.financials.priceHistory.at(-1).reason.transition, 'signing');
			assert.equal((await client.collection('rosterHistory').getFullList()).length, 1);
			assert.equal(
				(await client.collection('events').getFullList({ filter: 'type = "RacerSigned"' })).length,
				1
			);
			assert.equal(
				(await client.collection('news').getFullList({ filter: 'category = "signing"' })).length,
				1
			);

			const replacement = await client
				.collection('racers')
				.getFirstListItem(`trainer = "" && league = "" && id != "${signed.id}"`);
			await client.collection('racers').update(signed.id, {
				health: { ...signed.health, eligible: false, activeConditionIds: ['condition-1'] },
				status: { ...signed.status, injured: true }
			});
			const secondRequest = {
				method: 'POST',
				body: {
					now: '2026-09-02T12:00:00.000Z',
					seed: 'integration-roster-day-2',
					trainerIds: [trainerId],
					minimumPoolSize: 0,
					targetPoolSize: 0
				}
			};
			assert.deepEqual(await sendRosterRequest('replace', secondRequest), {
				signedRacers: 1,
				releasedRacers: 1,
				createdFreeAgents: 0
			});
			const released = await client.collection('racers').getOne(signed.id);
			assert.equal(released.trainer, '');
			assert.equal(released.league, '');
			assert.equal(released.financials.priceHistory.at(-1).reason.transition, 'release');
			assert.equal((await client.collection('rosterHistory').getFullList()).length, 3);
			assert.equal(
				(await client.collection('news').getFullList({ filter: 'category = "release"' })).length,
				1
			);
			const existingFreeAgents = await client.collection('racers').getFullList({
				filter: 'trainer = "" && league = ""'
			});
			for (const freeAgent of existingFreeAgents.filter(
				({ id }) => id !== released.id && Number(id.slice(-3)) > 100
			)) {
				await client.collection('racers').delete(freeAgent.id);
			}

			const replenishRequest = {
				method: 'POST',
				body: {
					now: '2026-09-03T12:00:00.000Z',
					seed: 'integration-pool-day-3',
					trainerIds: [],
					minimumPoolSize: 3,
					targetPoolSize: 4
				}
			};
			assert.deepEqual(await sendRosterRequest('replenish', replenishRequest), {
				signedRacers: 0,
				releasedRacers: 0,
				createdFreeAgents: 2
			});
			assert.deepEqual(await sendRosterRequest('repeat replenish', replenishRequest), {
				signedRacers: 0,
				releasedRacers: 0,
				createdFreeAgents: 0
			});
			const freeAgents = await client.collection('racers').getFullList({
				filter: 'trainer = "" && league = ""'
			});
			assert.equal(freeAgents.length, 4);
			assert.equal(new Set(freeAgents.map((racer) => racer.pokemon)).size, 4);
			assert.equal(
				(await client.collection('events').getFullList({ filter: 'type = "FreeAgentCreated"' }))
					.length,
				2
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
