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

const migrationName = '1786740700_add_atomic_race_settlement.js';
const serviceEmail = 'settlement-migration@example.com';
const servicePassword = 'settlement-migration-password';

test('migration reconstructs settled awards and freezes only unsettled legacy prize curves', async () => {
	const fixture = await createMigrationTestFixture('prl-settlement-migration-', migrationName);
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
		const racers = await client.collection('racers').getFullList({ sort: 'id' });
		const settledRaceId = 'prlseedrace0001';
		await Promise.all(
			racers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
		);
		await client.collection('racers').update(racers[0].id, {
			raceHistory: {
				...racers[0].raceHistory,
				races: [
					{
						raceId: settledRaceId,
						position: 1,
						prizeMoney: 12,
						date: '2026-08-01T12:00:00.000Z'
					}
				]
			}
		});
		await client.collection('racers').update(racers[1].id, {
			raceHistory: {
				...racers[1].raceHistory,
				races: [
					{
						raceId: settledRaceId,
						position: 2,
						prizeMoney: 5,
						date: '2026-08-01T12:00:00.000Z'
					}
				]
			}
		});
		await client.collection('races').update(settledRaceId, {
			status: 'settled',
			winner: racers[0].id,
			finishingOrder: [racers[0].id, racers[1].id]
		});

		await client.collection('leagues').update('prlseeddemo0001', { prizeMoneyScaling: 2 });
		const pendingRace = await client.collection('races').create({
			name: 'Legacy Pending Race',
			status: 'pending',
			league: 'prlseeddemo0001',
			racetrack: '175hl67e5pvjjib',
			startTime: '2026-08-20T12:00:00.000Z',
			totalLaps: 3
		});
		await Promise.all(
			racers
				.slice(2, 5)
				.map((racer) => client.collection('racers').update(racer.id, { race: pendingRace.id }))
		);

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

		const migratedSettledRace = await client.collection('races').getOne(settledRaceId);
		assert.deepEqual(migratedSettledRace.prizeCurve ?? [], []);
		assert.deepEqual(migratedSettledRace.awardedPrizes, [
			{ racerId: racers[0].id, position: 1, amount: 12 },
			{ racerId: racers[1].id, position: 2, amount: 5 }
		]);
		const migratedTrainerResults = await client.collection('trainerRaceResults').getFullList({
			filter: `race = "${settledRaceId}"`,
			sort: 'position'
		});
		assert.deepEqual(
			migratedTrainerResults.map((result) => ({
				racer: result.racer,
				trainer: result.trainer,
				attributionStatus: result.attributionStatus,
				position: result.position,
				earnings: result.earnings
			})),
			[
				{
					racer: racers[0].id,
					trainer: '',
					attributionStatus: 'unknown_legacy',
					position: 1,
					earnings: 12
				},
				{
					racer: racers[1].id,
					trainer: '',
					attributionStatus: 'unknown_legacy',
					position: 2,
					earnings: 5
				}
			]
		);
		assert.deepEqual((await client.collection('trainers').getOne(racers[0].trainer)).career, {
			starts: 0,
			wins: 0,
			podiums: 0,
			earnings: 0,
			championships: 0,
			recentResults: []
		});
		assert.deepEqual(await client.collection('trainerChampionships').getFullList(), []);
		assert.deepEqual(
			(await client.collection('races').getOne(pendingRace.id)).prizeCurve,
			[16, 14, 12, 10, 8, 6, 4, 2]
		);
		assert.deepEqual(
			(await client.collection('racers').getOne(racers[2].id)).currentRace.trainerAtEntry,
			{ status: 'attributed', trainerId: racers[2].trainer }
		);

		await client.collection('leagues').update('prlseeddemo0001', { prizeMoneyScaling: 100 });
		assert.deepEqual(
			(await client.collection('races').getOne(pendingRace.id)).prizeCurve,
			[16, 14, 12, 10, 8, 6, 4, 2]
		);
	} finally {
		if (server) await stopPocketBase(server);
		await rm(testDirectory, { recursive: true, force: true });
	}
});
