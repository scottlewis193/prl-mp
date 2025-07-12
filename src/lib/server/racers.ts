import pb from '$lib/pocketbase';
import type { Race } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';
import { createRandomPokemon } from './pokemon';

export async function createDefaultRacers(race: Race) {
	for (let i = 0; i < 20; i++) {
		const newPokemon = await createRandomPokemon();
		const newRacer: Partial<Racer> = {
			pokemon: newPokemon,
			name: newPokemon.name,
			raceId: race.id,
			checkpointIndex: 0,
			distanceFromCheckpoint: 0,
			lastUpdatedAt: new Date().toISOString(),
			lapTimes: {}
		};

		await pb.collection('racers').create(newRacer);
	}
}
