/// <reference path="../pb_data/types.d.ts" />

const seasonAwardCollectionId = 'prlseasonaward1';
const leagueMovementCollectionId = 'prlleaguemove01';
const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';

migrate(
	(app) => {
		const seasonAwards = new Collection({
			id: seasonAwardCollectionId,
			name: 'seasonAwards',
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
					collectionId: 'prlseasons00001',
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
				{
					type: 'relation',
					name: 'trainer',
					collectionId: 'prl_trainers_00',
					maxSelect: 1
				},
				{
					type: 'select',
					name: 'type',
					required: true,
					maxSelect: 1,
					values: ['league_champion']
				},
				{ type: 'number', name: 'position', required: true, min: 1 },
				{ type: 'text', name: 'name', required: true, max: 150 },
				{ type: 'date', name: 'occurredAt', required: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_season_award_league_type ON seasonAwards (season, league, type)',
				'CREATE INDEX idx_season_award_racer_date ON seasonAwards (racer, occurredAt)'
			]
		});
		app.save(seasonAwards);

		const leagueMovements = new Collection({
			id: leagueMovementCollectionId,
			name: 'leagueMovements',
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
					collectionId: 'prlseasons00001',
					maxSelect: 1,
					cascadeDelete: true
				},
				{
					type: 'relation',
					name: 'racer',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'fromLeague',
					required: true,
					collectionId: 'prl_leagues_000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'toLeague',
					required: true,
					collectionId: 'prl_leagues_000',
					maxSelect: 1
				},
				{
					type: 'select',
					name: 'direction',
					required: true,
					maxSelect: 1,
					values: ['promoted', 'relegated']
				},
				{ type: 'number', name: 'fromPosition', required: true, min: 1 },
				{ type: 'date', name: 'occurredAt', required: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_league_movement_season_racer ON leagueMovements (season, racer)',
				'CREATE INDEX idx_league_movement_racer_date ON leagueMovements (racer, occurredAt)'
			]
		});
		app.save(leagueMovements);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId(leagueMovementCollectionId));
		app.delete(app.findCollectionByNameOrId(seasonAwardCollectionId));
	}
);
