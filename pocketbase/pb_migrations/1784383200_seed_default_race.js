/// <reference path="../pb_data/types.d.ts" />

const seedIds = {
	track: '175hl67e5pvjjib',
	league: 'prlseeddemo0001',
	race: 'prlseedrace0001',
	pokemon: [
		'prlseedpoke0001',
		'prlseedpoke0002',
		'prlseedpoke0003',
		'prlseedpoke0004',
		'prlseedpoke0005',
		'prlseedpoke0006',
		'prlseedpoke0007',
		'prlseedpoke0008'
	],
	trainers: [
		'prlseedtrain001',
		'prlseedtrain002',
		'prlseedtrain003',
		'prlseedtrain004',
		'prlseedtrain005',
		'prlseedtrain006',
		'prlseedtrain007',
		'prlseedtrain008'
	],
	racers: [
		'prlseedracer001',
		'prlseedracer002',
		'prlseedracer003',
		'prlseedracer004',
		'prlseedracer005',
		'prlseedracer006',
		'prlseedracer007',
		'prlseedracer008'
	]
};

const pokemon = [
	{ name: 'pikachu', types: ['electric'], hp: 35, attack: 55, defense: 40, speed: 90 },
	{ name: 'bulbasaur', types: ['grass', 'poison'], hp: 45, attack: 49, defense: 49, speed: 45 },
	{ name: 'charmander', types: ['fire'], hp: 39, attack: 52, defense: 43, speed: 65 },
	{ name: 'squirtle', types: ['water'], hp: 44, attack: 48, defense: 65, speed: 43 },
	{ name: 'eevee', types: ['normal'], hp: 55, attack: 55, defense: 50, speed: 55 },
	{ name: 'meowth', types: ['normal'], hp: 40, attack: 45, defense: 35, speed: 90 },
	{ name: 'growlithe', types: ['fire'], hp: 55, attack: 70, defense: 45, speed: 60 },
	{ name: 'psyduck', types: ['water'], hp: 50, attack: 52, defense: 48, speed: 55 }
];

const trainers = [
	{ name: 'Ash', gender: 'male', motivation: 9, tactics: 6, bond: 10 },
	{ name: 'Misty', gender: 'female', motivation: 8, tactics: 8, bond: 9 },
	{ name: 'Brock', gender: 'male', motivation: 7, tactics: 9, bond: 8 },
	{ name: 'Erika', gender: 'female', motivation: 7, tactics: 8, bond: 8 },
	{ name: 'Lt. Surge', gender: 'male', motivation: 10, tactics: 7, bond: 6 },
	{ name: 'Sabrina', gender: 'female', motivation: 8, tactics: 10, bond: 7 },
	{ name: 'Blaine', gender: 'male', motivation: 8, tactics: 9, bond: 7 },
	{ name: 'Janine', gender: 'female', motivation: 9, tactics: 8, bond: 8 }
];

function createRecord(app, collectionName, id, data) {
	try {
		return app.findRecordById(collectionName, id);
	} catch {
		const collection = app.findCollectionByNameOrId(collectionName);
		const record = new Record(collection);
		record.set('id', id);
		for (var field in data) record.set(field, data[field]);
		app.save(record);
		return record;
	}
}

migrate(
	function (app) {
		var defaultTrackPath = $filepath.join(
			$os.getwd(),
			'src',
			'lib',
			'tracks',
			'defaultTrack.json'
		);
		var trackData = JSON.parse(toString($os.readFile(defaultTrackPath)));
		var checkpoints = [];
		var trackBounds = { x: 0, y: 0 };
		for (var layerIndex = 0; layerIndex < trackData.layers.length; layerIndex++) {
			var layer = trackData.layers[layerIndex];
			if (layer.name && layer.name.toLowerCase() === 'checkpoints') {
				for (var checkpointIndex = 0; checkpointIndex < layer.objects.length; checkpointIndex++) {
					var checkpoint = layer.objects[checkpointIndex];
					checkpoints.push({ index: Number(checkpoint.name), x: checkpoint.x, y: checkpoint.y });
				}
			}
			for (var chunkIndex = 0; chunkIndex < (layer.chunks || []).length; chunkIndex++) {
				var chunk = layer.chunks[chunkIndex];
				trackBounds.x = Math.max(trackBounds.x, (chunk.x + chunk.width) * trackData.tilewidth);
				trackBounds.y = Math.max(trackBounds.y, (chunk.y + chunk.height) * trackData.tileheight);
			}
		}
		checkpoints.sort(function (a, b) {
			return a.index - b.index;
		});
		var totalLength = 0;
		for (var lengthIndex = 0; lengthIndex < checkpoints.length; lengthIndex++) {
			var current = checkpoints[lengthIndex];
			var previous = checkpoints[(lengthIndex + checkpoints.length - 1) % checkpoints.length];
			totalLength += Math.hypot(current.x - previous.x, current.y - previous.y);
		}

		createRecord(app, 'racetracks', seedIds.track, {
			name: 'Default Track',
			checkpoints: checkpoints,
			data: trackData,
			totalLength: totalLength,
			width: trackData.tilewidth,
			maxSize: trackBounds
		});
		createRecord(app, 'leagues', seedIds.league, {
			name: 'Starter League',
			prizeMoneyScaling: 1,
			minRanking: 1,
			maxRanking: 8,
			maxPlayers: 8
		});
		createRecord(app, 'races', seedIds.race, {
			name: 'Starter League Opening Race',
			status: 'pending',
			racetrack: seedIds.track,
			totalLaps: 3
		});

		for (var index = 0; index < pokemon.length; index++) {
			var entry = pokemon[index];
			var stats = {
				hp: entry.hp,
				attack: entry.attack,
				defense: entry.defense,
				speed: entry.speed,
				spAttack: entry.attack,
				spDefense: entry.defense,
				baseStatTotal: entry.hp + entry.attack + entry.defense + entry.speed
			};
			createRecord(app, 'pokemon', seedIds.pokemon[index], {
				name: entry.name,
				animData: {},
				stats: stats,
				moves: [],
				types: entry.types,
				hp: entry.hp,
				attack: entry.attack,
				defense: entry.defense,
				speed: entry.speed
			});
			createRecord(app, 'trainers', seedIds.trainers[index], trainers[index]);
			createRecord(app, 'racers', seedIds.racers[index], {
				name: trainers[index].name + "'s " + entry.name,
				race: seedIds.race,
				league: seedIds.league,
				trainer: seedIds.trainers[index],
				pokemon: seedIds.pokemon[index],
				stats: {
					hp: entry.hp,
					attack: entry.attack,
					defense: entry.defense,
					speed: entry.speed,
					level: 1,
					ranking: index + 1,
					gender: trainers[index].gender
				},
				status: { retired: false, injured: false },
				currentRace: {
					lapsCompleted: 0,
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lastUpdatedAt: '',
					finished: false,
					lapTimes: {}
				},
				raceHistory: { wins: 0, totalRaces: 0, averageFinishPosition: 0, races: [] },
				positioning: {
					x: checkpoints[0].x,
					y: checkpoints[0].y,
					trackOffset: 0,
					targetTrackOffset: 0,
					lastOffsetChangeAt: 0
				},
				ownership: { totalShares: 1000, shareholders: [] },
				financials: {
					totalEarnings: 0,
					earningsPerShare: 0,
					issuedShares: 1000,
					outstandingShares: 1000,
					currentSharePrice: 10,
					priceHistory: []
				}
			});
		}
	},
	function (app) {
		for (var racerIndex = 0; racerIndex < seedIds.racers.length; racerIndex++) {
			app.delete(app.findRecordById('racers', seedIds.racers[racerIndex]));
		}
		app.delete(app.findRecordById('races', seedIds.race));
		for (var trainerIndex = 0; trainerIndex < seedIds.trainers.length; trainerIndex++) {
			app.delete(app.findRecordById('trainers', seedIds.trainers[trainerIndex]));
		}
		for (var pokemonIndex = 0; pokemonIndex < seedIds.pokemon.length; pokemonIndex++) {
			app.delete(app.findRecordById('pokemon', seedIds.pokemon[pokemonIndex]));
		}
		app.delete(app.findRecordById('leagues', seedIds.league));
		app.delete(app.findRecordById('racetracks', seedIds.track));
	}
);
