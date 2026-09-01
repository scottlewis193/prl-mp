/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			...events.fields.getByName('type').values,
			'SeasonCompleted'
		];
		app.save(events);

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = [
			...news.fields.getByName('category').values,
			'season_update'
		];
		app.save(news);
	},
	(app) => {
		for (const story of app
			.findAllRecords('news')
			.filter((record) => record.getString('category') === 'season_update')) {
			app.delete(story);
		}
		for (const event of app
			.findAllRecords('events')
			.filter((record) => record.getString('type') === 'SeasonCompleted')) {
			app.delete(event);
		}

		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('category').values = news.fields
			.getByName('category')
			.values.filter((value) => value !== 'season_update');
		app.save(news);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = events.fields
			.getByName('type')
			.values.filter((value) => value !== 'SeasonCompleted');
		app.save(events);
	}
);
