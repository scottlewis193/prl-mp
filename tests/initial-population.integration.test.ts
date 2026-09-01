import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import population from '../data/initial-population.v1.json';
import { generateRacerTraits } from '../src/lib/server/racerLifecycle';
import { NodePocketBase } from './support/node-pocketbase';
import {
	projectDirectory,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const execFileAsync = promisify(execFile);

async function migrateDown(binary: string, args: string[]) {
	const process = spawn(binary, args, { cwd: projectDirectory, stdio: ['pipe', 'ignore', 'pipe'] });
	let errorOutput = '';
	process.stderr.on('data', (chunk) => (errorOutput += chunk));
	process.stdin.end('y\n');
	const [exitCode] = (await once(process, 'exit')) as [number];
	if (exitCode !== 0) throw new Error(errorOutput || `Migration exited with code ${exitCode}`);
}

test(
	'a clean seed creates the configured deterministic racing population',
	{ timeout: 60_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-initial-population-'));
		const port = 18_000 + Math.floor(Math.random() * 10_000);
		const baseUrl = `http://127.0.0.1:${port}`;
		const serviceEmail = 'initial-population@example.com';
		const servicePassword = 'initial-population-password';
		let server: ChildProcess | undefined = await startPocketBase({
			baseUrl,
			port,
			dataDirectory,
			migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
			serviceEmail,
			servicePassword
		});

		try {
			let client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);

			const [leagues, trainers, racers, species, standings, rosterHistory] = await Promise.all([
				client.collection('leagues').getFullList({ sort: 'minRanking' }),
				client.collection('trainers').getFullList({ sort: 'id' }),
				client.collection('racers').getFullList({ sort: 'id' }),
				client.collection('pokemon').getFullList(),
				client.collection('leagueStandings').getFullList(),
				client.collection('rosterHistory').getFullList()
			]);

			assert.equal(leagues.length, population.leagues.names.length);
			assert.deepEqual(
				leagues.map(({ name }) => name),
				population.leagues.names
			);
			assert.deepEqual(
				leagues.map(({ minRanking, maxRanking, maxPlayers }) => ({
					minRanking,
					maxRanking,
					maxPlayers
				})),
				population.leagues.names.map((_, index) => ({
					minRanking: index * population.leagues.activeRacers + 1,
					maxRanking: (index + 1) * population.leagues.activeRacers,
					maxPlayers: population.leagues.activeRacers
				}))
			);

			assert.equal(trainers.length, population.trainers.count);
			assert.equal(
				trainers.every(
					({ rosterCapacity }) => rosterCapacity === population.trainers.rosterCapacity
				),
				true
			);
			const active = racers.filter(({ trainer, league }) => trainer && league);
			const freeAgents = racers.filter(({ trainer, league }) => !trainer && !league);
			assert.equal(
				active.length,
				population.leagues.names.length * population.leagues.activeRacers
			);
			assert.equal(freeAgents.length, population.freeAgents.target);
			for (const league of leagues) {
				assert.equal(
					active.filter(({ league: leagueId }) => leagueId === league.id).length,
					population.leagues.activeRacers
				);
			}
			for (const trainer of trainers) {
				assert.equal(
					active.filter(({ trainer: trainerId }) => trainerId === trainer.id).length,
					population.trainers.rosterCapacity
				);
			}

			const speciesIds = new Set(species.map(({ id }) => id));
			assert.equal(
				racers.every(({ pokemon }) => speciesIds.has(pokemon)),
				true
			);
			assert.equal(standings.length, active.length);
			assert.equal(rosterHistory.length, 0);
			for (const racer of racers) {
				assert.equal(racer.status.retired, false);
				assert.deepEqual(racer.health, {
					eligible: true,
					performanceMultiplier: 1,
					activeConditionIds: []
				});
				assert.deepEqual(racer.retirement, {});
				assert.equal(racer.traitRulesVersion, 'racer-traits-v1');
				assert.deepEqual(
					racer.traits,
					generateRacerTraits({
						speciesKey: racer.pokemon,
						generationSeed: racer.generationSeed,
						rulesVersion: racer.traitRulesVersion
					})
				);
			}

			const seededIds = {
				leagues: leagues.map(({ id }) => id),
				trainers: trainers.map(({ id }) => id),
				racers: racers.map(({ id }) => id)
			};
			await stopPocketBase(server);
			server = undefined;
			const migrationArguments = [
				`--dir=${dataDirectory}`,
				`--migrationsDir=${join(projectDirectory, 'pocketbase', 'pb_migrations')}`,
				`--hooksDir=${join(projectDirectory, 'pocketbase', 'pb_hooks')}`,
				'--hooksWatch=false'
			];
			await migrateDown(join(projectDirectory, 'pocketbase', 'pocketbase'), [
				'migrate',
				'down',
				'1',
				...migrationArguments
			]);
			await execFileAsync(
				join(projectDirectory, 'pocketbase', 'pocketbase'),
				['migrate', 'up', ...migrationArguments],
				{ cwd: projectDirectory }
			);
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
				serviceEmail,
				servicePassword
			});
			client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);
			assert.deepEqual(
				(await client.collection('leagues').getFullList({ sort: 'minRanking' })).map(
					({ id }) => id
				),
				seededIds.leagues
			);
			assert.deepEqual(
				(await client.collection('trainers').getFullList({ sort: 'id' })).map(({ id }) => id),
				seededIds.trainers
			);
			assert.deepEqual(
				(await client.collection('racers').getFullList({ sort: 'id' })).map(({ id }) => id),
				seededIds.racers
			);
			assert.equal((await client.collection('rosterHistory').getFullList()).length, 0);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
