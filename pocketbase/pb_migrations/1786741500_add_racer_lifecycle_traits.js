/// <reference path="../pb_data/types.d.ts" />

const racerTraitRulesVersion = 'racer-traits-v1';

// Applied migrations must remain stable if runtime lifecycle rules evolve, so the
// versioned generator is intentionally snapshotted here instead of imported.

function jsonField(record, fieldName, fallback) {
	try {
		const parsed = JSON.parse(toString(record.get(fieldName)));
		return parsed === null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

function hashRacerTraitSeed(value) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function createRacerTraitRandom(seed) {
	return function () {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function generateRacerTraits(speciesKey, generationSeed) {
	const random = createRacerTraitRandom(
		hashRacerTraitSeed(racerTraitRulesVersion + ':' + speciesKey + ':' + generationSeed)
	);
	const trait = function () {
		return Math.floor(random() * 100) + 1;
	};
	return {
		durability: trait(),
		resilience: trait(),
		temperament: trait(),
		consistency: trait(),
		potential: trait(),
		longevity: trait()
	};
}

function legacyCareerStartedAt(raceHistory) {
	let earliest = '';
	for (const race of raceHistory.races || []) {
		const date = String(race.date || '');
		if (date && (!earliest || date < earliest)) earliest = date;
	}
	return earliest || '2000-01-01 00:00:00.000Z';
}

migrate(
	(app) => {
		const racers = app.findCollectionByNameOrId('racers');
		racers.fields.add(
			new JSONField({ name: 'traits', maxSize: 10000 }),
			new TextField({ name: 'generationSeed', max: 200 }),
			new TextField({ name: 'traitRulesVersion', max: 100 }),
			new DateField({ name: 'careerStartedAt' }),
			new NumberField({ name: 'careerLoad', min: 0 })
		);
		app.save(racers);

		for (const racer of app.findAllRecords('racers')) {
			const speciesKey = racer.getString('pokemon');
			const generationSeed = 'legacy:' + racer.id + ':' + speciesKey;
			const raceHistory = jsonField(racer, 'raceHistory', {});
			racer.set('traits', generateRacerTraits(speciesKey, generationSeed));
			racer.set('generationSeed', generationSeed);
			racer.set('traitRulesVersion', racerTraitRulesVersion);
			racer.set('careerStartedAt', legacyCareerStartedAt(raceHistory));
			racer.set('careerLoad', Math.max(0, Number(raceHistory.totalRaces) || 0));
			app.save(racer);
		}
	},
	(app) => {
		const racers = app.findCollectionByNameOrId('racers');
		for (const name of [
			'careerLoad',
			'careerStartedAt',
			'traitRulesVersion',
			'generationSeed',
			'traits'
		]) {
			racers.fields.removeByName(name);
		}
		app.save(racers);
	}
);
