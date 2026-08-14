/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(
			new RelationField({
				name: 'league',
				collectionId: 'prl_leagues_000',
				maxSelect: 1
			})
		);
		races.indexes.push('CREATE INDEX idx_races_league_start_time ON races (league, startTime)');
		app.save(races);

		const events = app.findCollectionByNameOrId('events');
		events.fields.add(new TextField({ name: 'scheduleKey', max: 100 }));
		events.indexes.push(
			"CREATE UNIQUE INDEX idx_events_schedule_key ON events (scheduleKey) WHERE scheduleKey != ''"
		);
		app.save(events);
	},
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		events.indexes = events.indexes.filter((index) => !index.includes('idx_events_schedule_key'));
		events.fields.removeByName('scheduleKey');
		app.save(events);

		const races = app.findCollectionByNameOrId('races');
		races.indexes = races.indexes.filter((index) => !index.includes('idx_races_league_start_time'));
		races.fields.removeByName('league');
		app.save(races);
	}
);
