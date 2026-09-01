/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const racers = app.findCollectionByNameOrId('racers');
		racers.fields.add(new JSONField({ name: 'retirement', maxSize: 50000 }));
		app.save(racers);
		for (const racer of app.findAllRecords('racers')) {
			racer.set('retirement', {});
			app.save(racer);
		}

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			'DailyLeagueRaces',
			'RaceSettled',
			'HealthOnset',
			'HealthRecovery',
			'RacerRetired'
		];
		app.save(events);

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = [
			'race_result',
			'health_onset',
			'health_recovery',
			'retirement'
		];
		app.save(news);
	},
	(app) => {
		for (const story of app
			.findAllRecords('news')
			.filter((record) => record.getString('category') === 'retirement'))
			app.delete(story);
		for (const event of app
			.findAllRecords('events')
			.filter((record) => record.getString('type') === 'RacerRetired'))
			app.delete(event);
		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = ['race_result', 'health_onset', 'health_recovery'];
		app.save(news);
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			'DailyLeagueRaces',
			'RaceSettled',
			'HealthOnset',
			'HealthRecovery'
		];
		app.save(events);
		const racers = app.findCollectionByNameOrId('racers');
		racers.fields.removeByName('retirement');
		app.save(racers);
	}
);
