/// <reference path="../pb_data/types.d.ts" />

const eventTypes = [
	'DailyLeagueRaces',
	'RaceSettled',
	'HealthOnset',
	'HealthRecovery',
	'RacerRetired',
	'RacerSigned',
	'RacerReleased',
	'FreeAgentCreated'
];

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
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(
			new JSONField({ name: 'eligibilityPolicy', maxSize: 50000 }),
			new NumberField({ name: 'prizeScale', min: 0 }),
			new JSONField({ name: 'movePolicy', maxSize: 50000 }),
			new JSONField({ name: 'riskPolicy', maxSize: 50000 }),
			new JSONField({ name: 'wageringPolicy', maxSize: 50000 })
		);
		app.save(races);

		for (const race of app.findAllRecords('races')) {
			const leagueId = race.getString('league');
			const raceFormat = jsonField(race, 'raceFormat', {});
			const competitionType = raceFormat.type || 'league_race';
			const prizeCurve = jsonField(race, 'prizeCurve', []);
			const markets = jsonField(race, 'markets', {});
			let trackRisk = 0;
			try {
				trackRisk = app.findRecordById('racetracks', race.getString('racetrack')).getFloat('risk');
			} catch {}
			if (!raceFormat.type) {
				race.set('raceFormat', {
					type: 'league_race',
					ranked: true,
					rulesVersion: 'league-race-v1'
				});
			}
			race.set('eligibilityPolicy', {
				activeOnly: true,
				healthEligible: true,
				leagueId,
				retired: false,
				trainerRequired: true
			});
			race.set(
				'prizeScale',
				prizeCurve.length > 0 ? Math.max(0, Number(prizeCurve[prizeCurve.length - 1]) || 0) : 0
			);
			race.set('movePolicy', { enabled: false, rulesVersion: 'moves-disabled-v1' });
			race.set('riskPolicy', { level: 'standard', incidentMultiplier: 1, trackRisk });
			const wageringEnabled = competitionType === 'league_race' || markets.winnerType === 'winner';
			race.set('wageringPolicy', {
				enabled: wageringEnabled,
				markets: wageringEnabled ? ['winner'] : []
			});
			app.save(race);
		}

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = [...eventTypes, 'ExhibitionRace'];
		app.save(events);
	},
	(app) => {
		for (const event of app
			.findAllRecords('events')
			.filter((record) => record.getString('type') === 'ExhibitionRace')) {
			app.delete(event);
		}
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = eventTypes;
		app.save(events);

		const races = app.findCollectionByNameOrId('races');
		for (const fieldName of [
			'eligibilityPolicy',
			'prizeScale',
			'movePolicy',
			'riskPolicy',
			'wageringPolicy'
		]) {
			races.fields.removeByName(fieldName);
		}
		app.save(races);
	}
);
