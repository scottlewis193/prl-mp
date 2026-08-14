/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(new JSONField({ name: 'finishingOrder', maxSize: 50000 }));
		app.save(races);
	},
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('finishingOrder');
		app.save(races);
	}
);
