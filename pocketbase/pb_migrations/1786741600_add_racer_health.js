/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const racers = app.findCollectionByNameOrId('racers');
		racers.fields.add(new JSONField({ name: 'health', maxSize: 50000 }));
		app.save(racers);
		for (const racer of app.findAllRecords('racers')) {
			racer.set('health', {
				eligible: true,
				performanceMultiplier: 1,
				activeConditionIds: []
			});
			app.save(racer);
		}

		const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';
		const conditions = new Collection({
			id: 'prlhealthcond01',
			name: 'healthConditions',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{
					type: 'relation',
					name: 'racer',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1,
					cascadeDelete: true
				},
				{
					type: 'select',
					name: 'kind',
					required: true,
					maxSelect: 1,
					values: ['injury', 'illness']
				},
				{
					type: 'select',
					name: 'severity',
					required: true,
					maxSelect: 1,
					values: ['minor', 'moderate', 'severe']
				},
				{ type: 'text', name: 'cause', required: true, max: 200 },
				{ type: 'date', name: 'onsetAt', required: true },
				{ type: 'date', name: 'expectedRecoveryAt', required: true },
				{ type: 'date', name: 'recoveredAt' },
				{
					type: 'select',
					name: 'eligibilityEffect',
					required: true,
					maxSelect: 1,
					values: ['performance_penalty', 'ineligible']
				},
				{ type: 'number', name: 'performanceMultiplier', required: true, min: 0, max: 1 },
				{ type: 'json', name: 'inputs', required: true, maxSize: 100000 },
				{ type: 'number', name: 'roll', required: true, min: 0, max: 1 },
				{ type: 'number', name: 'probability', required: true, min: 0, max: 1 },
				{ type: 'text', name: 'rulesVersion', required: true, max: 100 },
				{
					type: 'relation',
					name: 'sourceEvent',
					required: true,
					collectionId: 'prl_events_0000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'recoveryEvent',
					collectionId: 'prl_events_0000',
					maxSelect: 1
				}
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_health_source_event ON healthConditions (sourceEvent)',
				'CREATE UNIQUE INDEX idx_health_recovery_event ON healthConditions (recoveryEvent) WHERE recoveryEvent != ""',
				'CREATE INDEX idx_health_racer_recovery ON healthConditions (racer, recoveredAt, expectedRecoveryAt)'
			]
		});
		app.save(conditions);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			'DailyLeagueRaces',
			'RaceSettled',
			'HealthOnset',
			'HealthRecovery'
		];
		app.save(events);

		const news = app.findCollectionByNameOrId('news');
		for (const name of ['race', 'league', 'track']) news.fields.getByName(name).required = false;
		news.fields.getByName('category').values = ['race_result', 'health_onset', 'health_recovery'];
		app.save(news);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('healthConditions'));
		for (const event of app
			.findAllRecords('events')
			.filter((record) => ['HealthOnset', 'HealthRecovery'].includes(record.getString('type')))) {
			app.delete(event);
		}

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = ['race_result'];
		for (const name of ['race', 'league', 'track']) news.fields.getByName(name).required = true;
		app.save(news);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = ['DailyLeagueRaces', 'RaceSettled'];
		app.save(events);

		const racers = app.findCollectionByNameOrId('racers');
		racers.fields.removeByName('health');
		app.save(racers);
	}
);
