import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import test from 'node:test';
import { NodePocketBase } from './support/node-pocketbase';

const projectDirectory = resolve(import.meta.dirname, '..');
const migrationName = '1786740700_add_atomic_race_settlement.js';
const serviceEmail = 'settlement-migration@example.com';
const servicePassword = 'settlement-migration-password';

async function waitForPocketBase(url: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			if ((await fetch(`${url}/api/health`)).ok) return;
		} catch {
			// The child process is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
	throw new Error('Timed out waiting for the PocketBase test server');
}

async function startPocketBase(
	baseUrl: string,
	port: number,
	dataDirectory: string,
	migrationsDirectory: string
): Promise<ChildProcess> {
	const server = spawn(
		join(projectDirectory, 'pocketbase', 'pocketbase'),
		[
			'serve',
			`--http=127.0.0.1:${port}`,
			`--dir=${dataDirectory}`,
			`--migrationsDir=${migrationsDirectory}`,
			`--hooksDir=${join(projectDirectory, 'pocketbase', 'pb_hooks')}`,
			'--hooksWatch=false'
		],
		{
			cwd: projectDirectory,
			env: {
				...process.env,
				PB_USER: serviceEmail,
				PB_PASS: servicePassword
			} as unknown as NodeJS.ProcessEnv,
			stdio: 'ignore'
		}
	);
	await waitForPocketBase(baseUrl);
	return server;
}

async function stopPocketBase(server: ChildProcess): Promise<void> {
	if (server.exitCode !== null) return;
	server.kill('SIGTERM');
	await once(server, 'exit');
}

test('migration reconstructs settled awards and freezes only unsettled legacy prize curves', async () => {
	const testDirectory = await mkdtemp(join(tmpdir(), 'prl-settlement-migration-'));
	const dataDirectory = join(testDirectory, 'data');
	const legacyMigrations = join(testDirectory, 'legacy-migrations');
	await mkdir(dataDirectory);
	await mkdir(legacyMigrations);
	const migrationsDirectory = join(projectDirectory, 'pocketbase', 'pb_migrations');
	for (const file of await readdir(migrationsDirectory)) {
		if (file.endsWith('.js') && file < migrationName) {
			await copyFile(join(migrationsDirectory, file), join(legacyMigrations, basename(file)));
		}
	}

	const port = 18_000 + Math.floor(Math.random() * 10_000);
	const baseUrl = `http://127.0.0.1:${port}`;
	let server: ChildProcess | undefined;
	try {
		server = await startPocketBase(baseUrl, port, dataDirectory, legacyMigrations);
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
		server = await startPocketBase(baseUrl, port, dataDirectory, migrationsDirectory);
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
			[6, 4, 2]
		);
		assert.deepEqual(
			(await client.collection('racers').getOne(racers[2].id)).currentRace.trainerAtEntry,
			{ status: 'attributed', trainerId: racers[2].trainer }
		);

		await client.collection('leagues').update('prlseeddemo0001', { prizeMoneyScaling: 100 });
		assert.deepEqual(
			(await client.collection('races').getOne(pendingRace.id)).prizeCurve,
			[6, 4, 2]
		);
	} finally {
		if (server) await stopPocketBase(server);
		await rm(testDirectory, { recursive: true, force: true });
	}
});
