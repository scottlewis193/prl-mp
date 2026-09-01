/// <reference path="../pb_data/types.d.ts" />

const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';

migrate(
	(app) => {
		const trainers = app.findCollectionByNameOrId('trainers');
		trainers.fields.add(
			new NumberField({ name: 'budget', min: 0 }),
			new NumberField({ name: 'rosterCapacity', min: 1, onlyInt: true })
		);
		app.save(trainers);
		for (const trainer of app.findAllRecords('trainers')) {
			trainer.set('budget', 1000);
			trainer.set('rosterCapacity', 4);
			app.save(trainer);
		}

		const history = new Collection({
			id: 'prlrosterhist01',
			name: 'rosterHistory',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: null,
			deleteRule: null,
			fields: [
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
					required: true,
					collectionId: 'prl_trainers_00',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'league',
					collectionId: 'prl_leagues_000',
					maxSelect: 1
				},
				{
					type: 'select',
					name: 'type',
					required: true,
					maxSelect: 1,
					values: ['signing', 'release']
				},
				{ type: 'date', name: 'occurredAt', required: true },
				{
					type: 'relation',
					name: 'sourceEvent',
					required: true,
					collectionId: 'prl_events_0000',
					maxSelect: 1,
					cascadeDelete: true
				},
				{ type: 'json', name: 'decision', required: true, maxSize: 100000 },
				{ type: 'json', name: 'valuation', required: true, maxSize: 100000 }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_roster_history_event ON rosterHistory (sourceEvent)',
				'CREATE INDEX idx_roster_history_racer_date ON rosterHistory (racer, occurredAt)',
				'CREATE INDEX idx_roster_history_trainer_date ON rosterHistory (trainer, occurredAt)'
			]
		});
		app.save(history);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			'DailyLeagueRaces',
			'RaceSettled',
			'HealthOnset',
			'HealthRecovery',
			'RacerRetired',
			'RacerSigned',
			'RacerReleased',
			'FreeAgentCreated'
		];
		app.save(events);

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = [
			'race_result',
			'health_onset',
			'health_recovery',
			'retirement',
			'signing',
			'release'
		];
		app.save(news);
	},
	(app) => {
		for (const story of app
			.findAllRecords('news')
			.filter((record) => ['signing', 'release'].includes(record.getString('category'))))
			app.delete(story);
		app.delete(app.findCollectionByNameOrId('rosterHistory'));

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = [
			'race_result',
			'health_onset',
			'health_recovery',
			'retirement'
		];
		app.save(news);

		for (const event of app
			.findAllRecords('events')
			.filter((record) =>
				['RacerSigned', 'RacerReleased', 'FreeAgentCreated'].includes(record.getString('type'))
			))
			app.delete(event);
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			'DailyLeagueRaces',
			'RaceSettled',
			'HealthOnset',
			'HealthRecovery',
			'RacerRetired'
		];
		app.save(events);

		const trainers = app.findCollectionByNameOrId('trainers');
		trainers.fields.removeByName('rosterCapacity');
		trainers.fields.removeByName('budget');
		app.save(trainers);
	}
);
