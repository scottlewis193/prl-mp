migrate(
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(new JSONField({ name: 'nonFinishers', maxSize: 100000 }));
		app.save(races);
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [
			...events.fields.getByName('type').values,
			'RaceIncident'
		];
		app.save(events);
	},
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = events.fields
			.getByName('type')
			.values.filter((value) => value !== 'RaceIncident');
		app.save(events);
		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('nonFinishers');
		app.save(races);
	}
);
