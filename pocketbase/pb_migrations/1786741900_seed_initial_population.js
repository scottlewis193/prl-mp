/// <reference path="../pb_data/types.d.ts" />

const configurationPath = $filepath.join($os.getwd(), 'data', 'initial-population.v1.json');
const seedRaceId = 'prlseedrace0001';
const seedSeasonId = 'prlseason000001';
const traitRulesVersion = 'racer-traits-v1';
const trainerNames = [
	['Ash', 'male'],
	['Misty', 'female'],
	['Brock', 'male'],
	['Erika', 'female'],
	['Lt. Surge', 'male'],
	['Sabrina', 'female'],
	['Blaine', 'male'],
	['Janine', 'female'],
	['Falkner', 'male'],
	['Bugsy', 'male'],
	['Whitney', 'female'],
	['Morty', 'male'],
	['Chuck', 'male'],
	['Jasmine', 'female'],
	['Pryce', 'male'],
	['Clair', 'female'],
	['Roxanne', 'female'],
	['Brawly', 'male'],
	['Wattson', 'male'],
	['Flannery', 'female'],
	['Norman', 'male'],
	['Winona', 'female'],
	['Tate', 'male'],
	['Liza', 'female'],
	['Wallace', 'male']
];

function leagueId(index) {
	return index === 0 ? 'prlseeddemo0001' : 'prlseedleague' + String(index + 1).padStart(2, '0');
}

function trainerId(index) {
	return 'prlseedtrain' + String(index + 1).padStart(3, '0');
}

function racerId(index) {
	return 'prlseedracer' + String(index + 1).padStart(3, '0');
}

function trainerProfile(index) {
	return (
		trainerNames[index] || [
			'Seed Trainer ' + String(index + 1).padStart(2, '0'),
			index % 2 === 0 ? 'male' : 'female'
		]
	);
}

function findOrCreate(app, collectionName, id) {
	try {
		return { record: app.findRecordById(collectionName, id), created: false };
	} catch {
		const record = new Record(app.findCollectionByNameOrId(collectionName));
		record.set('id', id);
		return { record, created: true };
	}
}

function jsonField(record, fieldName, fallback) {
	try {
		const parsed = JSON.parse(toString(record.get(fieldName)));
		return parsed === null ? fallback : parsed;
	} catch {
		return fallback;
	}
}

function hashSeed(value) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function createRandom(seed) {
	return function () {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function generateTraits(speciesKey, generationSeed) {
	const random = createRandom(
		hashSeed(traitRulesVersion + ':' + speciesKey + ':' + generationSeed)
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

function standingFor(app, seasonId, racerIdValue) {
	const matches = app.findRecordsByFilter(
		'leagueStandings',
		'season = {:season} && racer = {:racer}',
		'id',
		1,
		0,
		{ season: seasonId, racer: racerIdValue }
	);
	return matches.length > 0
		? matches[0]
		: new Record(app.findCollectionByNameOrId('leagueStandings'));
}

migrate(
	(app) => {
		const configuration = JSON.parse(toString($os.readFile(configurationPath)));
		const leagueCount = configuration.leagues.names.length;
		const leaguePopulation = configuration.leagues.activeRacers;
		const trainerCount = configuration.trainers.count;
		const rosterCapacity = configuration.trainers.rosterCapacity;
		const activeRacerCount = leagueCount * leaguePopulation;
		const totalRacerCount = activeRacerCount + configuration.freeAgents.target;
		if (trainerCount * rosterCapacity !== activeRacerCount) {
			throw new Error('Initial population configuration must assign every active racer');
		}
		const species = app
			.findAllRecords('pokemon')
			.sort((left, right) => left.getInt('pokedexNumber') - right.getInt('pokedexNumber'));
		if (species.length < totalRacerCount) {
			throw new Error('Initial population requires at least ' + totalRacerCount + ' species');
		}

		for (let index = 0; index < leagueCount; index += 1) {
			const result = findOrCreate(app, 'leagues', leagueId(index));
			const league = result.record;
			league.set('name', configuration.leagues.names[index]);
			league.set('prizeMoneyScaling', configuration.leagues.prizeMoneyScales[index]);
			league.set('minRanking', index * leaguePopulation + 1);
			league.set('maxRanking', (index + 1) * leaguePopulation);
			league.set('maxPlayers', leaguePopulation);
			app.save(league);
		}

		for (let index = 0; index < trainerCount; index += 1) {
			const result = findOrCreate(app, 'trainers', trainerId(index));
			const trainer = result.record;
			const profile = trainerProfile(index);
			trainer.set('name', profile[0]);
			trainer.set('gender', profile[1]);
			trainer.set('motivation', 6 + ((index * 3) % 5));
			trainer.set('tactics', 6 + ((index * 7) % 5));
			trainer.set('bond', 6 + ((index * 2) % 5));
			trainer.set('budget', configuration.trainers.startingBudget);
			trainer.set('rosterCapacity', rosterCapacity);
			if (result.created) {
				trainer.set('career', {
					starts: 0,
					wins: 0,
					podiums: 0,
					earnings: 0,
					championships: 0,
					recentResults: []
				});
			}
			app.save(trainer);
		}

		for (let index = 0; index < totalRacerCount; index += 1) {
			const result = findOrCreate(app, 'racers', racerId(index));
			const racer = result.record;
			const speciesRecord = result.created
				? species[index]
				: app.findRecordById('pokemon', racer.getString('pokemon'));
			const isActive = index < activeRacerCount;
			const activeLeagueIndex = Math.floor(index / leaguePopulation);
			const activeTrainerIndex = Math.floor(index / rosterCapacity);
			const generationSeed = configuration.seed + ':racer:' + String(index + 1).padStart(3, '0');
			const baseStats = jsonField(speciesRecord, 'stats', {});

			if (result.created) racer.set('pokemon', speciesRecord.id);
			racer.set('trainer', isActive ? trainerId(activeTrainerIndex) : '');
			racer.set('league', isActive ? leagueId(activeLeagueIndex) : '');
			racer.set('race', index < 8 ? seedRaceId : '');
			if (result.created) {
				const trainer = isActive ? trainerProfile(activeTrainerIndex) : null;
				racer.set(
					'name',
					trainer
						? trainer[0] + "'s " + speciesRecord.getString('name')
						: speciesRecord.getString('name')
				);
				racer.set('stats', {
					hp: Number(baseStats.hp) || speciesRecord.getInt('hp'),
					attack: Number(baseStats.attack) || speciesRecord.getInt('attack'),
					defense: Number(baseStats.defense) || speciesRecord.getInt('defense'),
					speed: Number(baseStats.speed) || speciesRecord.getInt('speed'),
					level: 1,
					ranking: index + 1,
					gender: trainer ? trainer[1] : index % 2 === 0 ? 'male' : 'female'
				});
				racer.set('status', { retired: false, injured: false });
				racer.set('currentRace', {
					lapsCompleted: 0,
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lastUpdatedAt: '',
					finished: false,
					lapTimes: {}
				});
				racer.set('raceHistory', { wins: 0, totalRaces: 0, averageFinishPosition: 0, races: [] });
				racer.set('positioning', {
					x: 1496,
					y: 1216,
					trackOffset: 0,
					targetTrackOffset: 0,
					lastOffsetChangeAt: 0
				});
				racer.set('ownership', { totalShares: 1000, shareholders: [] });
				racer.set('financials', {
					totalEarnings: 0,
					earningsPerShare: 0,
					issuedShares: 1000,
					outstandingShares: 1000,
					currentSharePrice: 10,
					priceHistory: []
				});
				racer.set('careerStartedAt', configuration.careerStartedAt);
				racer.set('careerLoad', 0);
				racer.set('generationSeed', generationSeed);
				racer.set('traitRulesVersion', traitRulesVersion);
				racer.set('traits', generateTraits(speciesRecord.id, generationSeed));
				racer.set('health', { eligible: true, performanceMultiplier: 1, activeConditionIds: [] });
				racer.set('retirement', {});
			}
			app.save(racer);

			if (isActive) {
				const standing = standingFor(app, seedSeasonId, racer.id);
				if (!standing.id) {
					standing.set('season', seedSeasonId);
					standing.set('racer', racer.id);
					standing.set('points', 0);
					standing.set('starts', 0);
					standing.set('wins', 0);
					standing.set('podiums', 0);
					standing.set('bestFinish', 0);
					standing.set('recentForm', []);
				}
				standing.set('league', leagueId(activeLeagueIndex));
				app.save(standing);
			}
		}

		const race = app.findRecordById('races', seedRaceId);
		race.set('league', leagueId(0));
		app.save(race);
	},
	(app) => {
		const configuration = JSON.parse(toString($os.readFile(configurationPath)));
		const activeRacerCount =
			configuration.leagues.names.length * configuration.leagues.activeRacers;
		const totalRacerCount = activeRacerCount + configuration.freeAgents.target;
		for (let index = 8; index < totalRacerCount; index += 1) {
			try {
				const racer = app.findRecordById('racers', racerId(index));
				for (const standing of app.findRecordsByFilter(
					'leagueStandings',
					'racer = {:racer}',
					'id',
					100,
					0,
					{ racer: racer.id }
				))
					app.delete(standing);
				app.delete(racer);
			} catch {}
		}
		for (let index = 8; index < configuration.trainers.count; index += 1) {
			try {
				app.delete(app.findRecordById('trainers', trainerId(index)));
			} catch {}
		}
		for (let index = 1; index < configuration.leagues.names.length; index += 1) {
			try {
				app.delete(app.findRecordById('leagues', leagueId(index)));
			} catch {}
		}
	}
);
