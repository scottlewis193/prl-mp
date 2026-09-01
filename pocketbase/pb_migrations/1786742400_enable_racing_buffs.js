/// <reference path="../pb_data/types.d.ts" />

function jsonField(record, fieldName, fallback) {
	try {
		const parsed = JSON.parse(toString(record.get(fieldName)));
		return parsed === null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

migrate(
	(app) => {
		for (const race of app.findAllRecords('races')) {
			const format = jsonField(race, 'raceFormat', {});
			if (
				!['league_race', 'grand_prix'].includes(format.type) ||
				['finished', 'settled', 'cancelled'].includes(race.getString('status'))
			) {
				continue;
			}
			race.set('movePolicy', {
				enabled: true,
				rulesVersion: 'racing-moves-v1',
				simulationSeed: `${format.type}:${race.id}`
			});
			app.save(race);
		}
	},
	(app) => {
		for (const race of app.findAllRecords('races')) {
			const policy = jsonField(race, 'movePolicy', {});
			if (policy.rulesVersion !== 'racing-moves-v1') continue;
			race.set('movePolicy', { enabled: false, rulesVersion: 'moves-disabled-v1' });
			app.save(race);
		}
	}
);
