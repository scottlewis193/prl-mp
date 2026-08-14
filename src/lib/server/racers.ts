import type { Pokemon, Racer, Trainer } from '$lib/types';
import pb from './pocketbase';
import { selectUnassignedRacers } from './racerAssignment';
import { selectRacerGender, selectRacerName } from './racerNames';
import { deleteAllRecords } from './recordDeletion';

// import { createRandomPokemon } from './pokemon';

// export async function createDefaultRacers(race: Race) {
// 	for (let i = 0; i < 20; i++) {
// 		const newPokemon = await createRandomPokemon();
// 		const newRacer = new Racer();
// 		newRacer.pokemon = newPokemon;
// 		newRacer.name = newPokemon.name;
// 		newRacer.race = race.id || '';
// 		const racerParsed = JSON.parse(JSON.stringify(newRacer));
// 		delete racerParsed.id;
// 		await pb.collection('racers').create(racerParsed);
// 	}
// }

export async function deleteAllRacers() {
	await deleteAllRecords(pb.collection('racers'));
}

export async function getAllRacers() {
	const racers = (await pb
		.collection('racers')
		.getFullList({ expand: 'pokemon,trainer,league' })) as Racer[];
	return racers;
}

export async function getRacers(raceId: string) {
	return (await pb.collection('racers').getFullList({
		filter: `race = "${raceId}"`,
		expand: 'pokemon,trainer,league'
	})) as Racer[];
}

export async function getUnassignedRacers() {
	const racers = (await pb.collection('racers').getFullList({
		filter: 'race = ""'
	})) as Racer[];

	return selectUnassignedRacers(racers);
}

export async function createUnassignedRacers() {
	if ((await getAllRacers()).length > 0) {
		return 0;
	}

	const [pokemon, trainers] = await Promise.all([
		pb.collection('pokemon').getFullList() as Promise<Pokemon[]>,
		pb.collection('trainers').getFullList() as Promise<Trainer[]>
	]);
	const racerCount = Math.min(pokemon.length, trainers.length);

	const created = await Promise.all(
		Array.from({ length: racerCount }, (_, index) => {
			const pokemonEntry = pokemon[index];
			const trainer = trainers[index];
			const gender = selectRacerGender();
			return pb.collection('racers').create({
				name: selectRacerName(gender),
				trainer: trainer.id,
				pokemon: pokemonEntry.id,
				stats: {
					hp: pokemonEntry.hp,
					attack: pokemonEntry.attack,
					defense: pokemonEntry.defense,
					speed: pokemonEntry.speed,
					level: 1,
					ranking: index + 1,
					gender
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
				positioning: { x: 0, y: 0, trackOffset: 0, targetTrackOffset: 0 },
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
		})
	);

	return created.length;
}

export async function updateRacer(racerId: string, updates: Partial<Racer>): Promise<boolean> {
	try {
		await pb.collection('racers').update(racerId, updates);

		return true;
	} catch (error) {
		console.log('Error updating racer:', racerId);

		return false;
	}
}

export async function updateRacersByRaceId(raceId: string, updates: Partial<Racer>) {
	const racers = await getRacers(raceId);

	await Promise.all(
		racers.map((racer) => {
			racer = { ...racer, ...updates };
			if (!racer.id) return Promise.resolve();
			return updateRacer(racer.id, racer);
		})
	);
}
