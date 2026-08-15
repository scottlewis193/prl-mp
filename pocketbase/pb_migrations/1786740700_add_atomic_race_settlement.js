/// <reference path="../pb_data/types.d.ts" />

// Keep this historical formula self-contained: migrations must remain stable even if runtime
// scheduling rules change later. Legacy races did not retain their original schedule-time curve.
function compatibilityPrizeCurve(entrantCount, league) {
	const places = Math.max(0, entrantCount);
	const scale = Math.max(0, league.getFloat('prizeMoneyScaling'));
	return Array.from({ length: places }, (_, index) => (places - index) * scale);
}

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
		races.fields.add(new JSONField({ name: 'prizeCurve', maxSize: 50000 }));
		races.fields.add(new JSONField({ name: 'awardedPrizes', maxSize: 100000 }));
		app.save(races);

		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('type').values = ['DailyLeagueRaces', 'RaceSettled'];
		events.fields.add(new TextField({ name: 'idempotencyKey', max: 100 }));
		events.fields.add(new DateField({ name: 'occurredAt' }));
		events.fields.add(new JSONField({ name: 'facts', maxSize: 200000 }));
		events.indexes.push(
			"CREATE UNIQUE INDEX idx_events_idempotency_key ON events (idempotencyKey) WHERE idempotencyKey != ''"
		);
		app.save(events);

		const historicalResultByRaceAndRacer = {};
		for (const racer of app.findAllRecords('racers')) {
			const history = jsonField(racer, 'raceHistory', {});
			for (const result of Array.isArray(history.races) ? history.races : []) {
				if (!result.raceId) continue;
				historicalResultByRaceAndRacer[`${result.raceId}:${racer.id}`] = result;
			}
		}

		for (const race of app.findAllRecords('races')) {
			const status = race.getString('status');
			if (status === 'settled') {
				// Settled legacy races can recover actual awards from durable racer histories, but
				// no prize curve is invented because its schedule-time configuration is unknowable;
				// incomplete histories remain undisplayed instead of presenting partial awards.
				const finishingOrder = jsonField(race, 'finishingOrder', []);
				const awardedPrizes = finishingOrder.flatMap((racerId, index) => {
					const result = historicalResultByRaceAndRacer[`${race.id}:${racerId}`];
					const amount = Number(result?.prizeMoney);
					return result && Number.isFinite(amount) && amount >= 0
						? [{ racerId, position: index + 1, amount }]
						: [];
				});
				if (finishingOrder.length > 0 && awardedPrizes.length === finishingOrder.length) {
					race.set('awardedPrizes', awardedPrizes);
					app.save(race);
				}
				continue;
			}
			if (status === 'cancelled') continue;

			const participants = app.findRecordsByFilter('racers', 'race = {:raceId}', 'id', 5000, 0, {
				raceId: race.id
			});
			if (participants.length === 0) continue;
			let leagueId = race.getString('league');
			if (!leagueId) leagueId = participants[0].getString('league');
			if (!leagueId) continue;
			const league = app.findRecordById('leagues', leagueId);
			// Unsettled legacy races adopt one compatibility snapshot at upgrade using their current
			// entrants and scale. This cannot reconstruct an earlier configuration, but it prevents
			// later configuration changes from altering their eventual settlement.
			race.set('prizeCurve', compatibilityPrizeCurve(participants.length, league));
			app.save(race);
		}
	},
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		events.indexes = events.indexes.filter(
			(index) => !index.includes('idx_events_idempotency_key')
		);
		events.fields.removeByName('facts');
		events.fields.removeByName('occurredAt');
		events.fields.removeByName('idempotencyKey');
		events.fields.getByName('type').values = ['DailyLeagueRaces'];
		app.save(events);

		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('awardedPrizes');
		races.fields.removeByName('prizeCurve');
		app.save(races);
	}
);
