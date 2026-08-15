/// <reference path="../pb_data/types.d.ts" />

const trainerResultCollectionId = 'prltrnresults00';
const trainerChampionshipCollectionId = 'prltrnchamps000';
const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';

function jsonField(record, fieldName, fallback) {
	try {
		const parsed = JSON.parse(toString(record.get(fieldName)));
		return parsed === null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

function projectCareer(results, championshipCount) {
	// Migrations are immutable/self-contained by convention, so this intentionally
	// mirrors the runtime projector instead of importing mutable hook code.
	const ordered = [...results].sort((left, right) => {
		const dateOrder = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
		return dateOrder || right.id.localeCompare(left.id);
	});
	return {
		starts: ordered.length,
		wins: ordered.filter((result) => result.position === 1).length,
		podiums: ordered.filter((result) => result.position <= 3).length,
		earnings: ordered.reduce((total, result) => total + result.earnings, 0),
		// Season championships are introduced by #23; legacy race wins are not championships.
		championships: championshipCount,
		recentResults: ordered.slice(0, 10).map((result) => ({
			resultId: result.id,
			raceId: result.raceId,
			racerId: result.racerId,
			position: result.position,
			earnings: result.earnings,
			occurredAt: result.occurredAt
		}))
	};
}

migrate(
	(app) => {
		const trainers = app.findCollectionByNameOrId('trainers');
		trainers.fields.add(new JSONField({ name: 'career', maxSize: 200000 }));
		app.save(trainers);

		const results = new Collection({
			id: trainerResultCollectionId,
			name: 'trainerRaceResults',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{
					type: 'relation',
					name: 'race',
					required: true,
					collectionId: 'prl_races_00000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'racer',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{ type: 'relation', name: 'trainer', collectionId: 'prl_trainers_00', maxSelect: 1 },
				{
					type: 'select',
					name: 'attributionStatus',
					required: true,
					maxSelect: 1,
					values: ['attributed', 'untrained', 'unknown_legacy']
				},
				{ type: 'number', name: 'position', required: true, min: 1 },
				{ type: 'number', name: 'earnings', required: true, min: 0 },
				{ type: 'date', name: 'occurredAt', required: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_trainer_results_race_racer ON trainerRaceResults (race, racer)',
				'CREATE INDEX idx_trainer_results_trainer_date ON trainerRaceResults (trainer, occurredAt)'
			]
		});
		app.save(results);

		// #23 will award these facts. This issue only establishes the auditable source
		// from which the trainer projection counts championships.
		const championships = new Collection({
			id: trainerChampionshipCollectionId,
			name: 'trainerChampionships',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{
					type: 'relation',
					name: 'trainer',
					required: true,
					collectionId: 'prl_trainers_00',
					maxSelect: 1
				},
				{ type: 'text', name: 'championshipKey', required: true, max: 100 },
				{ type: 'text', name: 'name', required: true, max: 150 },
				{ type: 'date', name: 'occurredAt', required: true }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_trainer_championship_key ON trainerChampionships (championshipKey)',
				'CREATE INDEX idx_trainer_championship_date ON trainerChampionships (trainer, occurredAt)'
			]
		});
		app.save(championships);

		for (const racer of app.findAllRecords('racers')) {
			const assignedRaceId = racer.getString('race');
			if (assignedRaceId) {
				// Active races are upgraded with a roster snapshot before any later roster move.
				const currentRace = jsonField(racer, 'currentRace', {});
				const trainerId = racer.getString('trainer');
				currentRace.trainerAtEntry = trainerId
					? { status: 'attributed', trainerId }
					: { status: 'untrained' };
				racer.set('currentRace', currentRace);
				app.save(racer);
			}
			const history = jsonField(racer, 'raceHistory', {});
			for (const historical of Array.isArray(history.races) ? history.races : []) {
				if (!historical.raceId) continue;
				let race;
				try {
					race = app.findRecordById('races', historical.raceId);
				} catch {
					continue;
				}
				if (race.getString('status') !== 'settled') continue;
				const position = Number(historical.position);
				const earnings = Number(historical.prizeMoney);
				const occurredAt = historical.date || race.getString('endTime');
				if (
					!Number.isInteger(position) ||
					position < 1 ||
					!Number.isFinite(earnings) ||
					earnings < 0 ||
					!Number.isFinite(Date.parse(occurredAt))
				)
					continue;

				const result = new Record(results);
				result.set('race', race.id);
				result.set('racer', racer.id);
				// Pre-upgrade histories never froze roster-at-entry. Crediting today's trainer
				// would fabricate evidence, so preserve the result as explicitly unattributed.
				result.set('attributionStatus', 'unknown_legacy');
				result.set('position', position);
				result.set('earnings', earnings);
				result.set('occurredAt', occurredAt);
				app.save(result);
			}
		}

		for (const trainer of app.findAllRecords('trainers')) {
			trainer.set('career', projectCareer([], 0));
			app.save(trainer);
		}
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId(trainerChampionshipCollectionId));
		app.delete(app.findCollectionByNameOrId(trainerResultCollectionId));
		const trainers = app.findCollectionByNameOrId('trainers');
		trainers.fields.removeByName('career');
		app.save(trainers);
	}
);
