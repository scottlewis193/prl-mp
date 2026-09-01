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

const serviceEmail = 'season-completion@example.com';
const servicePassword = 'season-completion-password';

test(
	'completing a season archives its tables and awards, exchanges adjacent racers, and retries once',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-season-completion-'));
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

			const [season] = await client.collection('seasons').getFullList({
				filter: 'status = "active"'
			});
			const [seedLeague] = await client
				.collection('leagues')
				.getFullList({ sort: 'minRanking,id' });
			const trainers = await client.collection('trainers').getFullList({ sort: 'id' });
			assert.ok(season && seedLeague && trainers.length > 0);
			await client.collection('leagues').update(seedLeague.id, {
				name: 'Premier League',
				minRanking: 1,
				maxRanking: 8,
				maxPlayers: 8
			});
			const allRacers = await client.collection('racers').getFullList({ sort: 'id' });
			const racers = allRacers.slice(0, 24);
			for (const standing of await client.collection('leagueStandings').getFullList({
				filter: `season = "${season.id}"`
			}))
				await client.collection('leagueStandings').delete(standing.id);
			for (const racer of allRacers) {
				await client.collection('racers').update(racer.id, {
					league: null,
					race: null,
					...(racers.includes(racer)
						? {}
						: { trainer: null, status: { retired: true, injured: false } })
				});
			}
			for (const league of (await client.collection('leagues').getFullList()).filter(
				(league) => league.id !== seedLeague.id
			))
				await client.collection('leagues').delete(league.id);
			const challenger = await client.collection('leagues').create({
				name: 'Challenger League',
				prizeMoneyScaling: 1,
				minRanking: 9,
				maxRanking: 16,
				maxPlayers: 8
			});
			const academy = await client.collection('leagues').create({
				name: 'Academy League',
				prizeMoneyScaling: 1,
				minRanking: 17,
				maxRanking: 24,
				maxPlayers: 8
			});
			const leagues = [seedLeague, challenger, academy];
			while (racers.length < 24) {
				const index = racers.length;
				racers.push(
					await client.collection('racers').create({
						name: `Season Racer ${index + 1}`,
						trainer: trainers[index % trainers.length].id,
						status: { retired: false, injured: false }
					})
				);
			}

			for (let index = 0; index < racers.length; index += 1) {
				const racer = racers[index];
				const league = leagues[Math.floor(index / 8)];
				const trainer = trainers[index % trainers.length];
				await client.collection('racers').update(racer.id, {
					league: league.id,
					trainer: trainer.id,
					race: null,
					status: { retired: false, injured: false }
				});
				const existing = await client.collection('leagueStandings').getFullList({
					filter: `season = "${season.id}" && racer = "${racer.id}"`
				});
				const standing = {
					season: season.id,
					league: league.id,
					racer: racer.id,
					points: 80 - (index % 8) * 10,
					starts: 4,
					wins: index % 8 === 0 ? 2 : 0,
					podiums: index % 8 < 3 ? 2 : 0,
					bestFinish: (index % 8) + 1,
					recentForm: [(index % 8) + 1]
				};
				if (existing[0])
					await client.collection('leagueStandings').update(existing[0].id, standing);
				else await client.collection('leagueStandings').create(standing);
			}
			await client.collection('racers').update(racers[0].id, {
				status: { retired: true, injured: false }
			});

			const completedAt = '2026-08-31T12:00:00.000Z';
			await assert.rejects(
				() =>
					client.send('/api/prl/seasons/complete', {
						method: 'POST',
						body: { seasonId: season.id, completedAt }
					}),
				/unfinished races/i
			);
			await client.collection('races').update('prlseedrace0001', { status: 'settled' });
			const completion = await client.send<{
				completed: boolean;
				seasonId: string;
				nextSeasonId: string;
				movements: number;
				awards: number;
			}>('/api/prl/seasons/complete', {
				method: 'POST',
				body: { seasonId: season.id, completedAt }
			});
			assert.equal(completion.completed, true);
			assert.equal(completion.seasonId, season.id);
			assert.equal(completion.movements, 16);
			assert.equal(completion.awards, 3);
			const completionEvents = await client.collection('events').getFullList({
				filter: `type = "SeasonCompleted"`
			});
			assert.equal(completionEvents.length, 1);
			assert.equal(completionEvents[0]?.idempotencyKey, `season-completed:${season.id}`);
			const seasonStories = await client.collection('news').getFullList({
				filter: `sourceEvent = "${completionEvents[0]?.id}"`
			});
			assert.equal(seasonStories.length, 1);
			assert.equal(seasonStories[0]?.category, 'season_update');
			assert.equal(seasonStories[0]?.importance, 95);
			assert.equal(seasonStories[0]?.templateVersion, 'season-story-v1');
			assert.match(seasonStories[0]?.summary ?? '', /promoted.*relegated/is);
			const storedSeasonStory = JSON.stringify(seasonStories[0]);

			const completedSeason = await client.collection('seasons').getOne(season.id);
			assert.equal(completedSeason.status, 'completed');
			assert.equal(Date.parse(completedSeason.endedAt), Date.parse(completedAt));
			const nextSeason = await client.collection('seasons').getOne(completion.nextSeasonId);
			assert.equal(nextSeason.status, 'active');
			assert.equal(nextSeason.name, 'Season 2');
			assert.equal(nextSeason.movementCount, 4);

			const archivedStandings = await client.collection('leagueStandings').getFullList({
				filter: `season = "${season.id}"`
			});
			assert.equal(archivedStandings.length, 24);
			assert.equal(
				archivedStandings.every((standing) => standing.starts === 4),
				true
			);
			const freshStandings = await client.collection('leagueStandings').getFullList({
				filter: `season = "${nextSeason.id}"`
			});
			assert.equal(freshStandings.length, 23);
			assert.equal(
				freshStandings.every(
					(standing) =>
						standing.points === 0 &&
						standing.starts === 0 &&
						standing.wins === 0 &&
						standing.podiums === 0 &&
						standing.bestFinish === 0 &&
						standing.recentForm.length === 0
				),
				true
			);

			const movement = await client.collection('leagueMovements').getFullList({ sort: 'racer' });
			assert.equal(movement.length, 16);
			assert.equal(
				movement.every((fact) => fact.season === season.id),
				true
			);
			assert.deepEqual(
				movement.reduce(
					(counts, fact) => ({ ...counts, [fact.direction]: (counts[fact.direction] ?? 0) + 1 }),
					{} as Record<string, number>
				),
				{ relegated: 8, promoted: 8 }
			);
			assert.equal(
				movement.some((fact) => fact.fromLeague === seedLeague.id && fact.direction === 'promoted'),
				false
			);
			assert.equal(
				movement.some((fact) => fact.fromLeague === academy.id && fact.direction === 'relegated'),
				false
			);

			const expectedLeagueByRacer = new Map<string, string>();
			for (let index = 0; index < racers.length; index += 1) {
				const place = index % 8;
				const leagueIndex = Math.floor(index / 8);
				const nextLeagueIndex =
					place < 4 && leagueIndex > 0
						? leagueIndex - 1
						: place >= 4 && leagueIndex < leagues.length - 1
							? leagueIndex + 1
							: leagueIndex;
				expectedLeagueByRacer.set(racers[index].id, leagues[nextLeagueIndex].id);
			}
			for (const racer of await client.collection('racers').getFullList({
				filter: racers.map(({ id }) => `id = "${id}"`).join(' || '),
				sort: 'id'
			})) {
				assert.equal(racer.league, expectedLeagueByRacer.get(racer.id));
			}

			const awards = await client.collection('seasonAwards').getFullList({ sort: 'league' });
			assert.equal(awards.length, 3);
			assert.equal(
				awards.every((award) => award.season === season.id && award.position === 1),
				true
			);
			assert.equal(awards.find((award) => award.league === seedLeague.id)?.racer, racers[0].id);
			const championships = await client.collection('trainerChampionships').getFullList();
			assert.equal(championships.length, 3);
			for (const trainer of await client.collection('trainers').getFullList()) {
				assert.equal(
					trainer.career.championships,
					championships.filter((championship) => championship.trainer === trainer.id).length
				);
			}

			const retry = await client.send<{ completed: boolean; seasonId: string }>(
				'/api/prl/seasons/complete',
				{
					method: 'POST',
					body: { seasonId: season.id, completedAt }
				}
			);
			assert.deepEqual(retry, { completed: false, seasonId: season.id });
			assert.equal((await client.collection('seasons').getFullList()).length, 2);
			assert.equal((await client.collection('leagueMovements').getFullList()).length, 16);
			assert.equal((await client.collection('seasonAwards').getFullList()).length, 3);
			assert.equal((await client.collection('trainerChampionships').getFullList()).length, 3);
			assert.equal(
				JSON.stringify(
					(
						await client.collection('news').getFullList({
							filter: `sourceEvent = "${completionEvents[0]?.id}"`
						})
					)[0]
				),
				storedSeasonStory
			);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
