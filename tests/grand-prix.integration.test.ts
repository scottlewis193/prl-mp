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

const serviceEmail = 'grand-prix@example.com';
const servicePassword = 'grand-prix-password';

test(
	'a multi-class Grand Prix snapshots its policy and settles overall and class results once',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-grand-prix-'));
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

			const leagues = (
				await client.collection('leagues').getFullList({ sort: 'minRanking,id' })
			).slice(0, 2);
			assert.equal(leagues.length, 2);
			const leagueIds = leagues.map((league) => league.id);
			const racers = await client.collection('racers').getFullList({
				filter: leagueIds.map((id) => `league = "${id}"`).join(' || '),
				sort: 'id'
			});
			await Promise.all(
				racers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			await client
				.collection('races')
				.update('prlseedrace0001', { status: 'settled', league: null });

			const scheduled = await client.send<{ raceId: string; created: boolean }>(
				'/api/prl/races/grand-prix/schedule',
				{
					method: 'POST',
					body: {
						requestKey: 'integration-grand-prix',
						leagueIds,
						startTime: '2026-09-04T12:00:00.000Z',
						entrantsPerClass: 2,
						totalLaps: 5,
						pointsEnabled: true,
						pointsCurve: [10, 4],
						prizeScale: 2,
						wageringEnabled: true,
						schedulingSeed: 'grand-prix-integration'
					}
				}
			);
			assert.equal(scheduled.created, true);
			const race = await client.collection('races').getOne(scheduled.raceId);
			const entrants = await client.collection('racers').getFullList({
				filter: `race = "${race.id}"`,
				sort: 'id'
			});
			assert.equal(entrants.length, 4);
			assert.deepEqual(race.raceFormat, {
				type: 'grand_prix',
				ranked: true,
				rulesVersion: 'grand-prix-v1'
			});
			assert.deepEqual(race.eligibilityPolicy.leagueIds, leagueIds);
			assert.deepEqual(race.pointsCurve, [10, 4]);
			assert.deepEqual(race.prizeCurve, [4, 2]);
			assert.deepEqual(race.wageringPolicy, { enabled: true, markets: ['winner'] });
			assert.equal(race.markets.winnerSelections.length, 4);
			assert.deepEqual(
				race.classEntries.map(
					({
						racerId,
						classId,
						className
					}: {
						racerId: string;
						classId: string;
						className: string;
					}) => ({
						racerId,
						classId,
						className
					})
				),
				entrants.map((racer) => ({
					racerId: racer.id,
					classId: racer.league,
					className: leagues.find((league) => league.id === racer.league)?.name
				}))
			);

			const ordered = [
				entrants.find((racer) => racer.league === leagueIds[0]),
				entrants.find((racer) => racer.league === leagueIds[1]),
				entrants.filter((racer) => racer.league === leagueIds[0])[1],
				entrants.filter((racer) => racer.league === leagueIds[1])[1]
			];
			assert.ok(ordered.every(Boolean));
			await Promise.all(
				ordered.map((racer, index) =>
					client.collection('racers').update(racer!.id, {
						currentRace: {
							...racer!.currentRace,
							finished: true,
							finishedAt: new Date(
								Date.parse('2026-09-04T12:30:00.000Z') + index * 1_000
							).toISOString()
						}
					})
				)
			);
			await client.collection('races').update(race.id, { status: 'finished' });
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId: race.id }
				}),
				{ settled: true }
			);

			const settled = await client.collection('races').getOne(race.id);
			assert.deepEqual(
				settled.finishingOrder,
				ordered.map((racer) => racer!.id)
			);
			assert.deepEqual(
				settled.classResults.map(
					(result: { racerId: string; overallPosition: number; classPosition: number }) => [
						result.racerId,
						result.overallPosition,
						result.classPosition
					]
				),
				ordered.map((racer, index) => [racer!.id, index + 1, index < 2 ? 1 : 2])
			);
			assert.deepEqual(
				settled.awardedPrizes.map((award: { amount: number }) => award.amount),
				[4, 4, 2, 2]
			);
			const standings = await Promise.all(
				ordered.map((racer) =>
					client
						.collection('leagueStandings')
						.getFirstListItem(`season != "" && racer = "${racer!.id}"`)
				)
			);
			assert.deepEqual(
				standings.map((standing) => [standing.points, standing.recentForm[0]]),
				[
					[10, 1],
					[10, 1],
					[4, 2],
					[4, 2]
				]
			);
			const beforeRetry = JSON.stringify(standings);
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId: race.id }
				}),
				{ settled: false }
			);
			assert.equal(
				JSON.stringify(
					await Promise.all(
						ordered.map((racer) =>
							client
								.collection('leagueStandings')
								.getFirstListItem(`season != "" && racer = "${racer!.id}"`)
						)
					)
				),
				beforeRetry
			);

			const standingsBeforeUnranked = JSON.stringify(
				await client.collection('leagueStandings').getFullList({ sort: 'id' })
			);
			const unranked = await client.send<{ raceId: string }>('/api/prl/races/grand-prix/schedule', {
				method: 'POST',
				body: {
					requestKey: 'unranked-grand-prix',
					leagueIds,
					startTime: '2026-09-05T12:00:00.000Z',
					entrantsPerClass: 1,
					pointsEnabled: false,
					prizeScale: 1,
					wageringEnabled: false
				}
			});
			const unrankedRace = await client.collection('races').getOne(unranked.raceId);
			assert.deepEqual(unrankedRace.pointsCurve, []);
			assert.equal(unrankedRace.raceFormat.ranked, false);
			assert.deepEqual(unrankedRace.wageringPolicy, { enabled: false, markets: [] });
			const unrankedEntrants = await client.collection('racers').getFullList({
				filter: `race = "${unrankedRace.id}"`,
				sort: 'id'
			});
			await Promise.all(
				unrankedEntrants.map((racer, index) =>
					client.collection('racers').update(racer.id, {
						currentRace: {
							...racer.currentRace,
							finished: true,
							finishedAt: new Date(
								Date.parse('2026-09-05T12:30:00.000Z') + index * 1_000
							).toISOString()
						}
					})
				)
			);
			await client.collection('races').update(unrankedRace.id, { status: 'finished' });
			await client.send('/api/prl/races/settle', {
				method: 'POST',
				body: { raceId: unrankedRace.id }
			});
			assert.equal(
				JSON.stringify(await client.collection('leagueStandings').getFullList({ sort: 'id' })),
				standingsBeforeUnranked
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
