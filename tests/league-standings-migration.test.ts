import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import test from 'node:test';

import { NodePocketBase } from './support/node-pocketbase';
import {
	createMigrationTestFixture,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const migrationName = '1786741200_add_season_standings.js';
const serviceEmail = 'season-migration@example.com';
const servicePassword = 'season-migration-password';

test(
	'migration creates an active season, initial tables, and snapshots pending league races',
	{ timeout: 30_000 },
	async () => {
		const fixture = await createMigrationTestFixture('prl-season-migration-', migrationName);
		const { testDirectory, dataDirectory, legacyMigrations, migrationsDirectory, port, baseUrl } =
			fixture;
		let server: ChildProcess | undefined;
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

			const seasons = await client.collection('seasons').getFullList();
			assert.equal(seasons.length, 1);
			assert.equal(seasons[0].status, 'active');
			assert.equal(seasons[0].rulesVersion, 'league-race-v1');
			assert.equal(seasons[0].movementCount, 4);

			const standings = await client.collection('leagueStandings').getFullList({ sort: 'racer' });
			assert.equal(standings.length, 8);
			assert.equal(
				standings.every((entry) => entry.season === seasons[0].id),
				true
			);
			assert.equal(
				standings.every((entry) => entry.league === 'prlseeddemo0001'),
				true
			);
			assert.equal(
				standings.every(
					(entry) =>
						entry.points === 0 &&
						entry.starts === 0 &&
						entry.wins === 0 &&
						entry.podiums === 0 &&
						entry.bestFinish === 0 &&
						Array.isArray(entry.recentForm) &&
						entry.recentForm.length === 0
				),
				true
			);

			const race = await client.collection('races').getOne('prlseedrace0001');
			assert.equal(race.league, 'prlseeddemo0001');
			assert.equal(race.season, seasons[0].id);
			assert.deepEqual(race.raceFormat, {
				type: 'league_race',
				ranked: true,
				rulesVersion: 'league-race-v1'
			});
			assert.deepEqual(race.pointsCurve, seasons[0].pointsCurve);
			assert.deepEqual(race.prizeCurve, [8, 7, 6, 5, 4, 3, 2, 1]);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(testDirectory, { recursive: true, force: true });
		}
	}
);
