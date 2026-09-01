/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('summary').max = 50000;
		app.save(news);
	},
	(app) => {
		const news = app.findCollectionByNameOrId('news');
		news.fields.getByName('summary').max = 2000;
		app.save(news);
	}
);
