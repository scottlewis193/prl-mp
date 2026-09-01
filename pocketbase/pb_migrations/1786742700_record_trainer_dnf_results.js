/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const results = app.findCollectionByNameOrId('trainerRaceResults');
		const position = results.fields.getByName('position');
		position.required = false;
		position.min = 0;
		results.fields.getByName('earnings').required = false;
		results.fields.add(
			new SelectField({
				name: 'outcome',
				maxSelect: 1,
				values: ['finished', 'dnf']
			})
		);
		app.save(results);

		for (const result of app.findAllRecords('trainerRaceResults')) {
			result.set('outcome', 'finished');
			app.save(result);
		}
		results.fields.getByName('outcome').required = true;
		app.save(results);
	},
	(app) => {
		for (const result of app
			.findAllRecords('trainerRaceResults')
			.filter((record) => record.getString('outcome') === 'dnf')) {
			app.delete(result);
		}
		const results = app.findCollectionByNameOrId('trainerRaceResults');
		results.fields.removeByName('outcome');
		const position = results.fields.getByName('position');
		position.required = true;
		position.min = 1;
		results.fields.getByName('earnings').required = true;
		app.save(results);
	}
);
