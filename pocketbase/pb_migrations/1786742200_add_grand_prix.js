/// <reference path="../pb_data/types.d.ts" />

const previousEventTypes = [
	'DailyLeagueRaces',
	'RaceSettled',
	'HealthOnset',
	'HealthRecovery',
	'RacerRetired',
	'RacerSigned',
	'RacerReleased',
	'FreeAgentCreated',
	'ExhibitionRace'
];

migrate(
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(
			new JSONField({ name: 'classEntries', maxSize: 100000 }),
			new JSONField({ name: 'classResults', maxSize: 100000 })
		);
		app.save(races);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [...previousEventTypes, 'GrandPrix'];
		app.save(events);
	},
	(app) => {
		for (const event of app
			.findAllRecords('events')
			.filter((record) => record.getString('type') === 'GrandPrix')) {
			app.delete(event);
		}
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = previousEventTypes;
		app.save(events);

		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('classEntries');
		races.fields.removeByName('classResults');
		app.save(races);
	}
);
