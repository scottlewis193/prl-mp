import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import test from 'node:test';

import { generateRacerTraits } from '../src/lib/server/racerLifecycle';
import { NodePocketBase } from './support/node-pocketbase';
import {
	createMigrationTestFixture,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const migrationName = '1786741500_add_racer_lifecycle_traits.js';
const serviceEmail = 'racer-lifecycle-migration@example.com';
const servicePassword = 'racer-lifecycle-migration-password';

test(
	'migration gives existing racers valid lifecycle traits without losing career or financial history',
	{ timeout: 30_000 },
	async () => {
		const fixture = await createMigrationTestFixture('prl-racer-lifecycle-', migrationName);
		const { testDirectory, dataDirectory, legacyMigrations, migrationsDirectory, port, baseUrl } =
			fixture;
		let server: ChildProcess | undefined;
		const raceHistory = {
			wins: 3,
			totalRaces: 12,
			averageFinishPosition: 2.25,
			races: [
				{
					raceId: 'prlseedrace0001',
					position: 1,
					prizeMoney: 75,
					date: '2026-08-31T12:00:00.000Z'
				}
			]
		};
		const financials = {
			totalEarnings: 375,
			earningsPerShare: 0.375,
			issuedShares: 1000,
			outstandingShares: 900,
			currentSharePrice: 14.5,
			priceHistory: [{ timestamp: '2026-08-31T12:00:00.000Z', price: 14.5 }]
		};

		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: legacyMigrations,
				serviceEmail,
				servicePassword
			});
			let client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);
			await client.collection('racers').update('prlseedracer001', { raceHistory, financials });
			await stopPocketBase(server);

			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory,
				serviceEmail,
				servicePassword
			});
			client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);

			const migrated = await client.collection('racers').getOne('prlseedracer001');
			assert.deepEqual(migrated.raceHistory, raceHistory);
			assert.deepEqual(migrated.financials, financials);
			assert.equal(migrated.traitRulesVersion, 'racer-traits-v1');
			assert.equal(migrated.generationSeed, 'legacy:prlseedracer001:prlseedpoke0001');
			assert.match(migrated.careerStartedAt, /^\d{4}-\d{2}-\d{2}/);
			assert.equal(migrated.careerLoad, 12);
			assert.deepEqual(
				migrated.traits,
				generateRacerTraits({
					speciesKey: migrated.pokemon,
					generationSeed: migrated.generationSeed,
					rulesVersion: migrated.traitRulesVersion
				})
			);
			assert.deepEqual(Object.keys(migrated.traits).sort(), [
				'consistency',
				'durability',
				'longevity',
				'potential',
				'resilience',
				'temperament'
			]);
			for (const value of Object.values(migrated.traits) as number[]) {
				assert.ok(value >= 1 && value <= 100);
			}
		} finally {
			if (server) await stopPocketBase(server);
			await rm(testDirectory, { recursive: true, force: true });
		}
	}
);
