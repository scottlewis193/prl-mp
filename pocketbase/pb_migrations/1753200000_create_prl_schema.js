/// <reference path="../pb_data/types.d.ts" />

const collectionIds = {
	users: '_pb_users_auth_',
	pokemon: 'prl_pokemon_000',
	trainers: 'prl_trainers_00',
	leagues: 'prl_leagues_000',
	racetracks: 'prl_tracks_0000',
	races: 'prl_races_00000',
	racers: 'prl_racers_0000',
	events: 'prl_events_0000',
	subscriptions: 'prl_subs_000000'
};

const serviceUserId = 'prlserviceuser0';
const serviceMutationRule = `@request.auth.id = "${serviceUserId}"`;

const publicReadRules = {
	listRule: '',
	viewRule: '',
	createRule: serviceMutationRule,
	updateRule: serviceMutationRule,
	deleteRule: serviceMutationRule
};

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId(collectionIds.users);
		users.listRule = `id = @request.auth.id || ${serviceMutationRule}`;
		users.viewRule = `id = @request.auth.id || ${serviceMutationRule}`;
		users.createRule = '';
		users.updateRule = 'id = @request.auth.id';
		users.deleteRule = 'id = @request.auth.id';
		users.authRule = '';
		users.fields.add(
			new JSONField({ name: 'options', maxSize: 20000 }),
			new JSONField({ name: 'watchlist', maxSize: 20000 }),
			new BoolField({ name: 'isFake' })
		);
		users.indexes = ['CREATE INDEX idx_users_is_fake ON users (isFake)'];
		app.save(users);

		const pokemon = new Collection({
			id: collectionIds.pokemon,
			name: 'pokemon',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'json', name: 'animData', maxSize: 2000000 },
				{ type: 'json', name: 'stats', maxSize: 50000 },
				{ type: 'json', name: 'moves', maxSize: 200000 },
				{ type: 'json', name: 'types', maxSize: 20000 },
				{ type: 'number', name: 'hp' },
				{ type: 'number', name: 'attack' },
				{ type: 'number', name: 'defense' },
				{ type: 'number', name: 'speed' },
				{
					type: 'file',
					name: 'overworldImage',
					maxSelect: 1,
					maxSize: 10485760,
					mimeTypes: ['image/png', 'image/gif', 'image/webp']
				},
				{
					type: 'file',
					name: 'leaderboardImage',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/png', 'image/jpeg', 'image/webp']
				}
			],
			indexes: ['CREATE UNIQUE INDEX idx_pokemon_name ON pokemon (name)']
		});
		app.save(pokemon);

		const trainers = new Collection({
			id: collectionIds.trainers,
			name: 'trainers',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'number', name: 'motivation', min: 0 },
				{ type: 'number', name: 'tactics', min: 0 },
				{ type: 'number', name: 'bond', min: 0 },
				{ type: 'select', name: 'gender', required: true, maxSelect: 1, values: ['male', 'female'] }
			]
		});
		app.save(trainers);

		const leagues = new Collection({
			id: collectionIds.leagues,
			name: 'leagues',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'number', name: 'prizeMoneyScaling', min: 0 },
				{ type: 'number', name: 'minRanking', min: 0 },
				{ type: 'number', name: 'maxRanking', min: 0 },
				{ type: 'number', name: 'maxPlayers', min: 1 }
			],
			indexes: ['CREATE UNIQUE INDEX idx_leagues_name ON leagues (name)']
		});
		app.save(leagues);

		const racetracks = new Collection({
			id: collectionIds.racetracks,
			name: 'racetracks',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'json', name: 'checkpoints', required: true, maxSize: 500000 },
				{ type: 'json', name: 'data', required: true, maxSize: 5000000 },
				{
					type: 'file',
					name: 'tileset',
					maxSelect: 1,
					maxSize: 20971520,
					mimeTypes: ['image/png', 'image/webp']
				},
				{ type: 'number', name: 'totalLength', min: 0 },
				{ type: 'number', name: 'width', min: 0 },
				{ type: 'json', name: 'maxSize', maxSize: 20000 }
			]
		});
		app.save(racetracks);

		const races = new Collection({
			id: collectionIds.races,
			name: 'races',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 150 },
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['pending', 'countdown', 'running', 'finished', 'cancelled', 'settled']
				},
				{
					type: 'relation',
					name: 'racetrack',
					collectionId: collectionIds.racetracks,
					maxSelect: 1
				},
				{ type: 'text', name: 'winner', max: 15 },
				{ type: 'date', name: 'startTime' },
				{ type: 'date', name: 'endTime' },
				{ type: 'number', name: 'totalLaps', min: 1 }
			],
			indexes: ['CREATE INDEX idx_races_status ON races (status)']
		});
		app.save(races);

		const racers = new Collection({
			id: collectionIds.racers,
			name: 'racers',
			type: 'base',
			...publicReadRules,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'relation', name: 'race', collectionId: collectionIds.races, maxSelect: 1 },
				{ type: 'relation', name: 'league', collectionId: collectionIds.leagues, maxSelect: 1 },
				{ type: 'relation', name: 'trainer', collectionId: collectionIds.trainers, maxSelect: 1 },
				{ type: 'relation', name: 'pokemon', collectionId: collectionIds.pokemon, maxSelect: 1 },
				{ type: 'json', name: 'stats', maxSize: 50000 },
				{ type: 'json', name: 'status', maxSize: 20000 },
				{ type: 'json', name: 'currentRace', maxSize: 100000 },
				{ type: 'json', name: 'raceHistory', maxSize: 500000 },
				{ type: 'json', name: 'positioning', maxSize: 50000 },
				{ type: 'json', name: 'ownership', maxSize: 500000 },
				{ type: 'json', name: 'financials', maxSize: 500000 }
			],
			indexes: [
				'CREATE INDEX idx_racers_race ON racers (race)',
				'CREATE INDEX idx_racers_league ON racers (league)',
				'CREATE INDEX idx_racers_pokemon ON racers (pokemon)'
			]
		});
		app.save(racers);

		const events = new Collection({
			id: collectionIds.events,
			name: 'events',
			type: 'base',
			...publicReadRules,
			fields: [
				{
					type: 'select',
					name: 'type',
					required: true,
					maxSelect: 1,
					values: ['DailyLeagueRaces']
				},
				{ type: 'date', name: 'startTime' },
				{ type: 'relation', name: 'raceIds', collectionId: collectionIds.races, maxSelect: 100 },
				{ type: 'bool', name: 'started' },
				{ type: 'bool', name: 'finished' }
			]
		});
		app.save(events);

		const subscriptions = new Collection({
			id: collectionIds.subscriptions,
			name: 'subscriptions',
			type: 'base',
			listRule: serviceMutationRule,
			viewRule: serviceMutationRule,
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{ type: 'url', name: 'endpoint', required: true },
				{ type: 'json', name: 'keys', required: true, maxSize: 20000 },
				{ type: 'date', name: 'expirationTime' }
			],
			indexes: ['CREATE UNIQUE INDEX idx_subscriptions_endpoint ON subscriptions (endpoint)']
		});
		app.save(subscriptions);
	},
	(app) => {
		for (const name of [
			'subscriptions',
			'events',
			'racers',
			'races',
			'racetracks',
			'leagues',
			'trainers',
			'pokemon'
		]) {
			app.delete(app.findCollectionByNameOrId(name));
		}

		const users = app.findCollectionByNameOrId(collectionIds.users);
		users.fields.removeByName('options');
		users.fields.removeByName('watchlist');
		users.fields.removeByName('isFake');
		users.indexes = [];
		users.listRule = 'id = @request.auth.id';
		users.viewRule = 'id = @request.auth.id';
		app.save(users);
	}
);
