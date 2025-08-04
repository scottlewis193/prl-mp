import type { Racer } from '$lib/types';
import pb from './pocketbase';

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
	const racersToDelete = await pb.collection('racers').getFullList();

	for (let racer of racersToDelete) {
		await pb.collection('racers').delete(racer.id);
	}
}

export async function getAllRacers() {
	const racers = (await pb
		.collection('racers')
		.getFullList({ expand: 'pokemon,trainer,league' })) as Racer[];
	return racers;
}

export async function getRacers(raceId: string) {
	return (await pb.collection('racers').getFullList({
		filter: `raceId.id = "${raceId}"`
	})) as Racer[];
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
