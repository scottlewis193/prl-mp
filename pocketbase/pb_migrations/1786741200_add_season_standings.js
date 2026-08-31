/// <reference path="../pb_data/types.d.ts" />

const seasonCollectionId = 'prlseasons00001';
const standingCollectionId = 'prlstandings001';
const initialSeasonId = 'prlseason000001';
const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';
const rulesVersion = 'league-race-v1';
const defaultPointsCurve = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function jsonField(record, fieldName, fallback) {
	try {
		const parsed = JSON.parse(toString(record.get(fieldName)));
		return parsed === null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

migrate(
	(app) => {
		const seasons = new Collection({
			id: seasonCollectionId,
			name: 'seasons',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['active', 'completed']
				},
				{ type: 'date', name: 'startedAt', required: true },
				{ type: 'date', name: 'endedAt' },
				{ type: 'text', name: 'rulesVersion', required: true, max: 100 },
				{ type: 'json', name: 'pointsCurve', required: true, maxSize: 50000 },
				{ type: 'number', name: 'movementCount', required: true, min: 0 }
			],
			indexes: [
				"CREATE UNIQUE INDEX idx_seasons_active ON seasons (status) WHERE status = 'active'"
			]
		});
		app.save(seasons);

		const standings = new Collection({
			id: standingCollectionId,
			name: 'leagueStandings',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{
					type: 'relation',
					name: 'season',
					required: true,
					collectionId: seasonCollectionId,
					maxSelect: 1,
					cascadeDelete: true
				},
				{
					type: 'relation',
					name: 'league',
					required: true,
					collectionId: 'prl_leagues_000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'racer',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{ type: 'number', name: 'points', min: 0 },
				{ type: 'number', name: 'starts', min: 0 },
				{ type: 'number', name: 'wins', min: 0 },
				{ type: 'number', name: 'podiums', min: 0 },
				{ type: 'number', name: 'bestFinish', min: 0 },
				{ type: 'json', name: 'recentForm', maxSize: 50000 },
				{ type: 'date', name: 'updatedAt' }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_league_standings_season_racer ON leagueStandings (season, racer)',
				'CREATE INDEX idx_league_standings_table ON leagueStandings (season, league, points DESC)'
			]
		});
		app.save(standings);

		const races = app.findCollectionByNameOrId('races');
		races.fields.add(
			new RelationField({
				name: 'season',
				collectionId: seasonCollectionId,
				maxSelect: 1
			}),
			new JSONField({ name: 'raceFormat', maxSize: 50000 }),
			new JSONField({ name: 'pointsCurve', maxSize: 50000 })
		);
		races.indexes.push('CREATE INDEX idx_races_season_league ON races (season, league)');
		app.save(races);

		const season = new Record(seasons);
		season.set('id', initialSeasonId);
		season.set('name', 'Season 1');
		season.set('status', 'active');
		season.set('startedAt', new Date().toISOString());
		season.set('rulesVersion', rulesVersion);
		season.set('pointsCurve', defaultPointsCurve);
		season.set('movementCount', 4);
		app.save(season);

		for (const racer of app.findAllRecords('racers')) {
			const leagueId = racer.getString('league');
			const status = jsonField(racer, 'status', {});
			if (!leagueId || !racer.getString('trainer') || status.retired) continue;
			const standing = new Record(standings);
			standing.set('season', season.id);
			standing.set('league', leagueId);
			standing.set('racer', racer.id);
			standing.set('points', 0);
			standing.set('starts', 0);
			standing.set('wins', 0);
			standing.set('podiums', 0);
			standing.set('bestFinish', 0);
			standing.set('recentForm', []);
			app.save(standing);
		}

		for (const race of app.findAllRecords('races')) {
			if (['cancelled', 'settled'].includes(race.getString('status'))) continue;
			const entrants = app.findRecordsByFilter('racers', 'race = {:raceId}', 'id', 5000, 0, {
				raceId: race.id
			});
			let leagueId = race.getString('league');
			if (!leagueId && entrants.length > 0) {
				const entrantLeagues = [...new Set(entrants.map((racer) => racer.getString('league')))];
				if (entrantLeagues.length === 1 && entrantLeagues[0]) {
					leagueId = entrantLeagues[0];
					race.set('league', leagueId);
				}
			}
			if (!leagueId) continue;
			const league = app.findRecordById('leagues', leagueId);
			const leagueCapacity = Math.max(1, league.getInt('maxPlayers'));
			const existingPrizeCurve = jsonField(race, 'prizeCurve', []);
			const prizeScale =
				existingPrizeCurve.length > 0
					? Number(existingPrizeCurve[existingPrizeCurve.length - 1])
					: league.getFloat('prizeMoneyScaling');
			race.set('season', season.id);
			race.set('raceFormat', { type: 'league_race', ranked: true, rulesVersion });
			race.set('pointsCurve', defaultPointsCurve);
			race.set(
				'prizeCurve',
				Array.from({ length: leagueCapacity }, (_, index) =>
					Math.max(0, (leagueCapacity - index) * prizeScale)
				)
			);
			app.save(race);
		}
	},
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.indexes = races.indexes.filter((index) => !index.includes('idx_races_season_league'));
		races.fields.removeByName('pointsCurve');
		races.fields.removeByName('raceFormat');
		races.fields.removeByName('season');
		app.save(races);
		app.delete(app.findCollectionByNameOrId(standingCollectionId));
		app.delete(app.findCollectionByNameOrId(seasonCollectionId));
	}
);
