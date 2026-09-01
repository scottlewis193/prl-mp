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

const serviceEmail = 'league-season@example.com';
const servicePassword = 'league-season-password';

test(
	'ranked League Races create missing table rows, snapshot full policy, and settle points once',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-league-season-'));
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

			const seedRaceId = 'prlseedrace0001';
			const leagueId = 'prlseeddemo0001';
			const racers = await client.collection('racers').getFullList({
				filter: `league = "${leagueId}"`,
				sort: 'id'
			});
			await Promise.all(
				racers.map((racer) => client.collection('racers').update(racer.id, { race: null }))
			);
			await client.collection('races').update(seedRaceId, { status: 'settled', league: null });
			await client.collection('leagues').update(leagueId, {
				maxPlayers: racers.length,
				prizeMoneyScaling: 2
			});
			const injured = racers.at(-1);
			assert.ok(injured);
			await client.collection('racers').update(injured.id, {
				status: { ...injured.status, injured: true }
			});
			const injuredStanding = await client
				.collection('leagueStandings')
				.getFirstListItem(`racer = "${injured.id}"`);
			await client.collection('leagueStandings').delete(injuredStanding.id);

			await client.send('/api/prl/schedule/reconcile', {
				method: 'POST',
				body: {
					now: '2026-08-14T12:00:00.000Z',
					futureEventCount: 1,
					eventIntervalMs: 60 * 60 * 1000,
					scheduleOffsetMs: 0,
					countdownMs: 5 * 60 * 1000,
					totalLaps: 3
				}
			});

			const [season] = await client
				.collection('seasons')
				.getFullList({ filter: 'status = "active"' });
			const [rankedRace] = await client.collection('races').getFullList({
				filter: `season = "${season.id}" && league = "${leagueId}" && status = "pending"`
			});
			const entrants = await client.collection('racers').getFullList({
				filter: `race = "${rankedRace.id}"`,
				sort: 'id'
			});
			assert.equal(entrants.length, racers.length - 1);
			assert.equal(
				entrants.some((racer) => racer.id === injured.id),
				false
			);
			assert.equal(
				(
					await client
						.collection('leagueStandings')
						.getFullList({ filter: `racer = "${injured.id}"` })
				).length,
				1
			);
			assert.equal(rankedRace.league, leagueId);
			assert.equal(rankedRace.season, season.id);
			assert.deepEqual(rankedRace.raceFormat, {
				type: 'league_race',
				ranked: true,
				rulesVersion: season.rulesVersion
			});
			assert.deepEqual(rankedRace.pointsCurve, season.pointsCurve);
			assert.deepEqual(rankedRace.eligibilityPolicy, {
				activeOnly: true,
				healthEligible: true,
				leagueId,
				retired: false,
				trainerRequired: true
			});
			assert.equal(rankedRace.prizeScale, 2);
			assert.deepEqual(rankedRace.movePolicy, {
				enabled: false,
				rulesVersion: 'moves-disabled-v1'
			});
			assert.deepEqual(rankedRace.wageringPolicy, { enabled: true, markets: ['winner'] });
			assert.equal(rankedRace.riskPolicy.level, 'standard');
			assert.equal(rankedRace.riskPolicy.incidentMultiplier, 1);
			assert.deepEqual(
				rankedRace.prizeCurve,
				Array.from({ length: racers.length }, (_, index) => (racers.length - index) * 2)
			);

			const completedAt = Date.parse('2026-08-14T13:30:00.000Z');
			await Promise.all(
				entrants.map((racer, index) =>
					client.collection('racers').update(racer.id, {
						currentRace: {
							...racer.currentRace,
							finished: true,
							finishedAt: new Date(completedAt + index * 1_000).toISOString()
						}
					})
				)
			);
			await client.collection('races').update(rankedRace.id, { status: 'finished' });
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId: rankedRace.id }
				}),
				{ settled: true }
			);

			const rankedStandings = await client.collection('leagueStandings').getFullList({
				filter: `season = "${season.id}" && league = "${leagueId}"`,
				sort: '-points,-wins,-podiums,bestFinish,racer'
			});
			assert.deepEqual(
				rankedStandings.map((standing) => ({
					racer: standing.racer,
					points: standing.points,
					starts: standing.starts,
					wins: standing.wins,
					podiums: standing.podiums,
					bestFinish: standing.bestFinish,
					recentForm: standing.recentForm
				})),
				[
					...entrants.map((racer, index) => ({
						racer: racer.id,
						points: rankedRace.pointsCurve[index],
						starts: 1,
						wins: index === 0 ? 1 : 0,
						podiums: index < 3 ? 1 : 0,
						bestFinish: index + 1,
						recentForm: [index + 1]
					})),
					{
						racer: injured.id,
						points: 0,
						starts: 0,
						wins: 0,
						podiums: 0,
						bestFinish: 0,
						recentForm: []
					}
				].sort(
					(left, right) =>
						right.points - left.points ||
						right.wins - left.wins ||
						right.podiums - left.podiums ||
						left.bestFinish - right.bestFinish ||
						left.racer.localeCompare(right.racer)
				)
			);
			const beforeRetry = JSON.stringify(rankedStandings);
			assert.deepEqual(
				await client.send('/api/prl/races/settle', {
					method: 'POST',
					body: { raceId: rankedRace.id }
				}),
				{ settled: false }
			);
			assert.equal(
				JSON.stringify(
					await client.collection('leagueStandings').getFullList({
						filter: `season = "${season.id}" && league = "${leagueId}"`,
						sort: '-points,-wins,-podiums,bestFinish,racer'
					})
				),
				beforeRetry
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
