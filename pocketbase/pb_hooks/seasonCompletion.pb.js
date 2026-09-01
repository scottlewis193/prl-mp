/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/seasons/complete',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may complete seasons.', {});
		}
		const body = e.requestInfo().body || {};
		const seasonId = String(body.seasonId || '');
		if (!seasonId) throw e.badRequestError('seasonId is required.', {});
		const completedAt =
			body.completedAt === undefined ? new Date().toISOString() : String(body.completedAt);
		if (!Number.isFinite(Date.parse(completedAt))) {
			throw e.badRequestError('completedAt must be a valid date.', {});
		}

		let result;
		try {
			e.app.runInTransaction((txApp) => {
				const season = txApp.findRecordById('seasons', seasonId);
				if (season.getString('status') === 'completed') {
					result = { completed: false, seasonId };
					return;
				}
				if (season.getString('status') !== 'active') {
					throw e.badRequestError('Only an active season can be completed.', {});
				}
				const otherActiveSeasons = txApp.findRecordsByFilter(
					'seasons',
					'status = "active" && id != {:seasonId}',
					'id',
					1,
					0,
					{ seasonId }
				);
				if (otherActiveSeasons.length > 0) {
					throw e.badRequestError('Exactly one active season is required.', {});
				}
				const unfinishedRaces = txApp.findRecordsByFilter(
					'races',
					'season = {:seasonId} && status != "settled" && status != "cancelled"',
					'id',
					1,
					0,
					{ seasonId }
				);
				if (unfinishedRaces.length > 0) {
					throw e.badRequestError('The season still has unfinished races.', {});
				}

				const leagues = txApp.findRecordsByFilter('leagues', 'id != ""', 'minRanking,id', 1000, 0);
				const standings = txApp.findRecordsByFilter(
					'leagueStandings',
					'season = {:seasonId}',
					'id',
					5000,
					0,
					{ seasonId }
				);
				const racerById = {};
				for (const racer of txApp.findAllRecords('racers')) racerById[racer.id] = racer;
				const statusFor = (racer) => {
					const status = new DynamicModel({ retired: false, injured: false });
					racer.unmarshalJSONField('status', status);
					return status;
				};
				const eligibleStanding = (standing) => {
					const racer = racerById[standing.getString('racer')];
					return (
						racer &&
						racer.getString('league') === standing.getString('league') &&
						!!racer.getString('trainer') &&
						!statusFor(racer).retired
					);
				};
				const orderedByLeague = {};
				const positionByRacer = {};
				for (const league of leagues) {
					const ordered = require(`${__hooks}/leagueStandings.cjs`).orderLeagueStandings(
						standings
							.filter((standing) => standing.getString('league') === league.id)
							.map((standing) => ({
								record: standing,
								racerId: standing.getString('racer'),
								points: standing.getFloat('points'),
								starts: standing.getInt('starts'),
								wins: standing.getInt('wins'),
								podiums: standing.getInt('podiums'),
								bestFinish: standing.getInt('bestFinish'),
								recentForm: JSON.parse(toString(standing.get('recentForm')) || '[]')
							}))
					);
					orderedByLeague[league.id] = ordered;
					for (let index = 0; index < ordered.length; index += 1) {
						positionByRacer[ordered[index].racerId] = index + 1;
					}
				}

				const awardCollection = txApp.findCollectionByNameOrId('seasonAwards');
				const championshipCollection = txApp.findCollectionByNameOrId('trainerChampionships');
				const championshipTrainerIds = {};
				const championFacts = [];
				let awards = 0;
				for (const league of leagues) {
					const championStanding = (orderedByLeague[league.id] || [])[0];
					if (!championStanding) continue;
					const racer = racerById[championStanding.racerId];
					if (!racer) continue;
					const trainerId = racer.getString('trainer');
					const awardName = `${season.getString('name')} ${league.getString('name')} champion`;
					const award = new Record(awardCollection);
					award.set('season', season.id);
					award.set('league', league.id);
					award.set('racer', racer.id);
					if (trainerId) award.set('trainer', trainerId);
					award.set('type', 'league_champion');
					award.set('position', 1);
					award.set('name', awardName);
					award.set('occurredAt', completedAt);
					txApp.save(award);

					if (trainerId) {
						const championship = new Record(championshipCollection);
						championship.set('trainer', trainerId);
						championship.set('championshipKey', `${season.id}:${league.id}`);
						championship.set('name', awardName);
						championship.set('occurredAt', completedAt);
						txApp.save(championship);
						championshipTrainerIds[trainerId] = true;
					}
					championFacts.push({
						racer: { id: racer.id, name: racer.getString('name') },
						league: { id: league.id, name: league.getString('name') },
						trainerId: trainerId || null
					});
					awards += 1;
				}

				const movementCount = Math.max(0, season.getInt('movementCount'));
				const plannedMovements = [];
				const selectedRacers = {};
				for (let leagueIndex = 0; leagueIndex < leagues.length - 1; leagueIndex += 1) {
					const upperLeague = leagues[leagueIndex];
					const lowerLeague = leagues[leagueIndex + 1];
					const upperCandidates = (orderedByLeague[upperLeague.id] || [])
						.filter((entry) => eligibleStanding(entry.record) && !selectedRacers[entry.racerId])
						.slice()
						.reverse()
						.slice(0, movementCount);
					const lowerCandidates = (orderedByLeague[lowerLeague.id] || [])
						.filter((entry) => eligibleStanding(entry.record) && !selectedRacers[entry.racerId])
						.slice(0, movementCount);
					const exchangeCount = Math.min(upperCandidates.length, lowerCandidates.length);
					for (let index = 0; index < exchangeCount; index += 1) {
						const relegated = upperCandidates[index];
						const promoted = lowerCandidates[index];
						selectedRacers[relegated.racerId] = true;
						selectedRacers[promoted.racerId] = true;
						plannedMovements.push({
							racerId: relegated.racerId,
							fromLeague: upperLeague.id,
							toLeague: lowerLeague.id,
							direction: 'relegated',
							fromPosition: positionByRacer[relegated.racerId]
						});
						plannedMovements.push({
							racerId: promoted.racerId,
							fromLeague: lowerLeague.id,
							toLeague: upperLeague.id,
							direction: 'promoted',
							fromPosition: positionByRacer[promoted.racerId]
						});
					}
				}

				const movementCollection = txApp.findCollectionByNameOrId('leagueMovements');
				for (const planned of plannedMovements) {
					const racer = racerById[planned.racerId];
					racer.set('league', planned.toLeague);
					txApp.save(racer);
					const movement = new Record(movementCollection);
					movement.set('season', season.id);
					movement.set('racer', planned.racerId);
					movement.set('fromLeague', planned.fromLeague);
					movement.set('toLeague', planned.toLeague);
					movement.set('direction', planned.direction);
					movement.set('fromPosition', planned.fromPosition);
					movement.set('occurredAt', completedAt);
					txApp.save(movement);
				}

				season.set('status', 'completed');
				season.set('endedAt', completedAt);
				txApp.save(season);
				const allSeasons = txApp.findRecordsByFilter('seasons', 'id != ""', 'id', 1000, 0);
				const nextSeason = new Record(txApp.findCollectionByNameOrId('seasons'));
				nextSeason.set('name', `Season ${allSeasons.length + 1}`);
				nextSeason.set('status', 'active');
				nextSeason.set('startedAt', completedAt);
				nextSeason.set('rulesVersion', season.getString('rulesVersion'));
				nextSeason.set('pointsCurve', JSON.parse(toString(season.get('pointsCurve')) || '[]'));
				nextSeason.set('movementCount', movementCount);
				txApp.save(nextSeason);

				const standingCollection = txApp.findCollectionByNameOrId('leagueStandings');
				for (const racer of txApp.findRecordsByFilter(
					'racers',
					'league != "" && trainer != ""',
					'id',
					5000,
					0
				)) {
					if (statusFor(racer).retired) continue;
					const standing = new Record(standingCollection);
					standing.set('season', nextSeason.id);
					standing.set('league', racer.getString('league'));
					standing.set('racer', racer.id);
					standing.set('points', 0);
					standing.set('starts', 0);
					standing.set('wins', 0);
					standing.set('podiums', 0);
					standing.set('bestFinish', 0);
					standing.set('recentForm', []);
					txApp.save(standing);
				}
				for (const trainerId of Object.keys(championshipTrainerIds)) {
					require(`${__hooks}/trainerCareer.cjs`).rebuildTrainerCareer(txApp, trainerId);
				}

				const leagueById = {};
				for (const league of leagues) leagueById[league.id] = league;
				const movementFacts = plannedMovements.map((movement) => ({
					racer: {
						id: movement.racerId,
						name: racerById[movement.racerId].getString('name')
					},
					fromLeague: {
						id: movement.fromLeague,
						name: leagueById[movement.fromLeague].getString('name')
					},
					toLeague: {
						id: movement.toLeague,
						name: leagueById[movement.toLeague].getString('name')
					},
					direction: movement.direction
				}));
				const completionEvent = new Record(txApp.findCollectionByNameOrId('events'));
				completionEvent.set('type', 'SeasonCompleted');
				completionEvent.set('idempotencyKey', `season-completed:${season.id}`);
				completionEvent.set('occurredAt', completedAt);
				completionEvent.set('started', true);
				completionEvent.set('finished', true);
				completionEvent.set('facts', {
					season: { id: season.id, name: season.getString('name') },
					champions: championFacts,
					movements: movementFacts
				});
				txApp.save(completionEvent);

				const story = require(`${__hooks}/seasonNews.cjs`).buildSeasonStory({
					eventId: completionEvent.id,
					occurredAt: completedAt,
					season: { id: season.id, name: season.getString('name') },
					champions: championFacts,
					movements: movementFacts
				});
				const news = new Record(txApp.findCollectionByNameOrId('news'));
				news.set('sourceEvent', completionEvent.id);
				news.set('racers', [
					...new Set([
						...championFacts.map((champion) => champion.racer.id),
						...movementFacts.map((movement) => movement.racer.id)
					])
				]);
				news.set('trainers', Object.keys(championshipTrainerIds));
				news.set('category', story.category);
				news.set('importance', story.importance);
				news.set('publishedAt', story.publishedAt);
				news.set('headline', story.headline);
				news.set('summary', story.summary);
				news.set('templateVersion', story.templateVersion);
				news.set('links', story.links);
				txApp.save(news);

				result = {
					completed: true,
					seasonId: season.id,
					nextSeasonId: nextSeason.id,
					movements: plannedMovements.length,
					awards
				};
			});
		} catch (error) {
			e.app.logger().error('Season completion transaction failed', 'error', String(error));
			throw error;
		}
		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
