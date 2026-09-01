/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		const type = events.fields.getByName('type');
		if (!type.values.includes('LegendsExhibition')) type.values.push('LegendsExhibition');
		app.save(events);
	},
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		const type = events.fields.getByName('type');
		type.values = type.values.filter((value) => value !== 'LegendsExhibition');
		app.save(events);
	}
);
