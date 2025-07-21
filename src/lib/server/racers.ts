import pb from '$lib/pocketbase';
import type { Race } from '$lib/stores/race.svelte';
import { Racer } from '$lib/stores/racer.svelte';
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
