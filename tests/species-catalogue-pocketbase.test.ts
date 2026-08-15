import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { NodePocketBase } from './support/node-pocketbase';

const projectDirectory = resolve(import.meta.dirname, '..');
const execFileAsync = promisify(execFile);

async function waitForPocketBase(url: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			if ((await fetch(`${url}/api/health`)).ok) return;
		} catch {
			// PocketBase is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
	throw new Error('Timed out waiting for the PocketBase test server');
}

test('migration imports one complete offline Generation I–V catalogue', async () => {
	const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-species-catalogue-'));
	const port = 18_000 + Math.floor(Math.random() * 10_000);
	const baseUrl = `http://127.0.0.1:${port}`;
	const serviceEmail = 'species-catalogue@example.com';
	const servicePassword = 'species-catalogue-password';
	const superuserEmail = 'species-superuser@example.com';
	const superuserPassword = 'species-superuser-password';
	const server: ChildProcess = spawn(
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
				PB_PASS: servicePassword,
				PB_SUPERUSER_EMAIL: superuserEmail,
				PB_SUPERUSER_PASS: superuserPassword
			} as unknown as NodeJS.ProcessEnv,
			stdio: 'ignore'
		}
	);

	try {
		await waitForPocketBase(baseUrl);
		const client = new NodePocketBase(baseUrl);
		client.autoCancellation(false);
		await client.collection('users').authWithPassword(serviceEmail, servicePassword);
		const records = await client.collection('pokemon').getFullList({ sort: 'pokedexNumber' });

		assert.equal(records.length, 649);
		assert.equal(new Set(records.map(({ pokedexNumber }) => pokedexNumber)).size, 649);
		assert.deepEqual(records[648].animData, {
			AnimData: {
				Anims: {
					Anim: [
						{
							Name: 'Walk',
							FrameWidth: 32,
							FrameHeight: 40,
							Durations: { Duration: [8, 10, 8, 10] }
						}
					]
				}
			}
		});
		assert.deepEqual(
			{
				pokedexNumber: records[648].pokedexNumber,
				name: records[648].name,
				generation: records[648].generation,
				types: records[648].types,
				stats: records[648].stats,
				provenance: records[648].provenance,
				assetState: records[648].assetState
			},
			{
				pokedexNumber: 649,
				name: 'Genesect',
				generation: 5,
				types: ['bug', 'steel'],
				stats: {
					hp: 71,
					attack: 120,
					defense: 95,
					specialAttack: 120,
					specialDefense: 95,
					speed: 99,
					total: 600
				},
				provenance: records[0].provenance,
				assetState: {
					portrait: 'fallback',
					walkAnimation: 'fallback',
					fallbackSpecies: 'pikachu'
				}
			}
		);

		const importResult = await execFileAsync('bun', ['scripts/import-pokemon-species.ts'], {
			cwd: projectDirectory,
			env: {
				...process.env,
				PUBLIC_PB_URL: baseUrl,
				PB_USER: serviceEmail,
				PB_PASS: servicePassword
			} as unknown as NodeJS.ProcessEnv
		});
		assert.match(
			importResult.stdout,
			/Pokemon species catalogue imported: 0 created, 649 updated, 649 total/
		);
		assert.equal((await client.collection('pokemon').getFullList()).length, 649);

		const schemaResult = await execFileAsync('node', ['scripts/verify-pocketbase.mjs'], {
			cwd: projectDirectory,
			env: {
				...process.env,
				PUBLIC_PB_URL: baseUrl,
				PB_USER: serviceEmail,
				PB_PASS: servicePassword,
				PB_SUPERUSER_EMAIL: superuserEmail,
				PB_SUPERUSER_PASS: superuserPassword
			} as unknown as NodeJS.ProcessEnv
		});
		assert.match(schemaResult.stdout, /PocketBase schema verified:/);
	} finally {
		if (server.exitCode === null) {
			server.kill('SIGTERM');
			await once(server, 'exit');
		}
		await rm(dataDirectory, { recursive: true, force: true });
	}
});
