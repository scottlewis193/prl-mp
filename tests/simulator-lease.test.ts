import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import PocketBase from 'pocketbase';

const projectDirectory = resolve(import.meta.dirname, '..');
const serviceEmail = 'simulator-test@example.com';
const servicePassword = 'simulator-test-password';

let dataDirectory = '';
let server: ChildProcess;
let baseUrl = '';
let firstWorker: PocketBase;
let secondWorker: PocketBase;

async function waitForPocketBase(url: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			const response = await fetch(`${url}/api/health`);
			if (response.ok) return;
		} catch {
			// The child process is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
	throw new Error('Timed out waiting for the PocketBase test server');
}

async function claim(client: PocketBase, ownerId: string, ttlMs: number) {
	return client.send('/api/prl/simulator/lease', {
		method: 'POST',
		body: { ownerId, ttlMs }
	}) as Promise<{ acquired: boolean; token?: number }>;
}

async function commit(
	client: PocketBase,
	ownerId: string,
	token: number,
	racerUpdates: unknown[] = []
) {
	return client.send('/api/prl/simulator/commit', {
		method: 'POST',
		body: { ownerId, token, racerUpdates }
	}) as Promise<{ committed: boolean }>;
}

before(async () => {
	dataDirectory = await mkdtemp(join(tmpdir(), 'prl-simulator-test-'));
	const port = 18_000 + Math.floor(Math.random() * 10_000);
	baseUrl = `http://127.0.0.1:${port}`;
	server = spawn(
		join(projectDirectory, 'pocketbase', 'pocketbase'),
		[
			'serve',
			`--http=127.0.0.1:${port}`,
			`--dir=${dataDirectory}`,
			`--migrationsDir=${join(projectDirectory, 'pocketbase', 'pb_migrations')}`,
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
	firstWorker = new PocketBase(baseUrl);
	secondWorker = new PocketBase(baseUrl);
	await Promise.all([
		firstWorker.collection('users').authWithPassword(serviceEmail, servicePassword),
		secondWorker.collection('users').authWithPassword(serviceEmail, servicePassword)
	]);
});

after(async () => {
	if (server && server.exitCode === null) {
		server.kill('SIGTERM');
		await once(server, 'exit');
	}
	await rm(dataDirectory, { recursive: true, force: true });
});

test('excludes concurrent owners and permits recovery after the lease expires', async () => {
	const [firstClaim, secondClaim] = await Promise.all([
		claim(firstWorker, 'worker-one', 25),
		claim(secondWorker, 'worker-two', 25)
	]);

	assert.equal([firstClaim.acquired, secondClaim.acquired].filter(Boolean).length, 1);

	await new Promise((resolveWait) => setTimeout(resolveWait, 50));
	const recoveredClaim = await claim(secondWorker, 'replacement-worker', 5_000);

	assert.equal(recoveredClaim.acquired, true);
	assert.notEqual(recoveredClaim.token, firstClaim.token ?? secondClaim.token);
	const racer = await secondWorker.collection('racers').getOne('prlseedracer001');
	const staleUpdate = {
		id: racer.id,
		currentRace: { ...racer.currentRace, distanceFromCheckpoint: 111 },
		positioning: { ...racer.positioning, x: 111 },
		stats: racer.stats
	};
	assert.equal(
		(
			await commit(
				firstWorker,
				firstClaim.acquired ? 'worker-one' : 'worker-two',
				(firstClaim.token ?? secondClaim.token) as number,
				[staleUpdate]
			)
		).committed,
		false
	);
	const currentUpdate = {
		...staleUpdate,
		currentRace: { ...racer.currentRace, distanceFromCheckpoint: 222 },
		positioning: { ...racer.positioning, x: 222 }
	};
	assert.equal(
		(
			await commit(secondWorker, 'replacement-worker', recoveredClaim.token as number, [
				currentUpdate
			])
		).committed,
		true
	);
	const persistedRacer = await secondWorker.collection('racers').getOne(racer.id);
	assert.equal(persistedRacer.currentRace.distanceFromCheckpoint, 222);
	assert.equal(persistedRacer.positioning.x, 222);
});
