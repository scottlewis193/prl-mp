import { building, dev } from '$app/environment';
import PocketBase from 'pocketbase';
import { startUp } from '$lib/server/serverTick';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import pb from '$lib/pocketbase';
import { getMugshot, getSpriteSheet } from '$lib/server/pokemon';
import { URL } from '$env/static/private';
import { PUBLIC_PB_URL } from '$env/static/public';
import { female, male } from '$lib/server/static/names';
import { Pokemon, Racer } from '$lib/stores/racer.svelte';
import { Trainer } from '$lib/stores/trainer.svelte';

export const init: ServerInit = async () => {
	startUp();
	// importGen1to5RacersToPocketBase();
};

function formatPokemonStats(stats: any[]): {
	hp: number;
	attack: number;
	defense: number;
	spAttack: number;
	spDefense: number;
	speed: number;
	baseStatTotal: number;
} {
	const getStat = (name: string) => stats.find((s) => s.stat.name === name)?.base_stat || 0;

	const hp = getStat('hp');
	const attack = getStat('attack');
	const defense = getStat('defense');
	const spAttack = getStat('special-attack');
	const spDefense = getStat('special-defense');
	const speed = getStat('speed');

	const baseStatTotal = hp + attack + defense + spAttack + spDefense + speed;

	return {
		hp,
		attack,
		defense,
		spAttack,
		spDefense,
		speed,
		baseStatTotal
	};
}

function formatTypes(types: any[]): string[] {
	return types.map((type) => type.type.name);
}

function formatMoves(moves: any[]): {}[] {
	//first we grab level up moves from black-2-white-v2
	let filteredMoves = moves.filter((move) => {
		let details = move.version_group_details.find(
			(detail: { move_learn_method: { name: string }; version_group: { name: string } }) =>
				detail.version_group.name === 'black-2-white-2' &&
				detail.move_learn_method.name === 'level-up'
		);
		if (details) return true;
	});

	const formattedMoves = filteredMoves.map((move) => ({
		name: move.move.name,
		level: move.version_group_details.find(
			(detail: { move_learn_method: { name: string }; version_group: { name: string } }) =>
				detail.version_group.name === 'black-2-white-2'
		).level_learned_at
	}));

	return formattedMoves;
}

async function importGen1to5RacersToPocketBase() {
	//delete all
	// const pokemonRecords = await pb.collection('pokemon').getFullList({ batch: 2000 });
	// for (const record of pokemonRecords) {
	// 	await pb.collection('pokemon').delete(record.id);
	// }
	const racerRecords = await pb.collection('racers').getFullList({ batch: 2000 });
	for (const record of racerRecords) {
		await pb.collection('racers').delete(record.id);
	}
	const trainerRecords = await pb.collection('trainers').getFullList({ batch: 2000 });
	for (const record of trainerRecords) {
		await pb.collection('trainers').delete(record.id);
	}

	console.log('deleted all records');

	const startId = 1;
	const endId = 649;

	// for (let id = startId; id <= endId; id++) {
	// 	try {
	// 		const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
	// 		if (!res.ok) {
	// 			console.warn(`Failed to fetch Pokémon #${id}`);
	// 			continue;
	// 		}

	// 		const data = await res.json();
	// 		const stats = formatPokemonStats(data.stats);
	// 		const types = formatTypes(data.types);
	// 		const moves = formatMoves(data.moves);

	// 		const mugshotLocation = await getMugshot(id);
	// 		if (!mugshotLocation) {
	// 			console.warn(`Failed to fetch mugshot for Pokémon #${id}`);
	// 			continue;
	// 			//return;
	// 		}
	// 		const spriteSheetLocation = await getSpriteSheet(id);
	// 		if (!spriteSheetLocation) {
	// 			console.warn(`Failed to fetch sprite sheet for Pokémon #${id}`);
	// 			continue;
	// 			//return;
	// 		}

	// 		let pokemon = new Pokemon();
	// 		pokemon.name = data.name;
	// 		pokemon.stats = stats;
	// 		pokemon.types = types;
	// 		pokemon.moves = moves;
	// 		delete pokemon.id;

	// 		await pb.collection('pokemon').create({
	// 			...JSON.parse(JSON.stringify(pokemon)),
	// 			overworldImage: spriteSheetLocation,
	// 			leaderboardImage: mugshotLocation
	// 		});
	// 		console.log(`Created pokemon for ${data.name} (#${id})`);
	// 	} catch (err) {
	// 		console.error(`Error creating racer for Pokémon #${id}:`, err);
	// 	}
	// }

	//next we create 150 trainers
	const trainers = [];
	for (let i = 0; i < 150; i++) {
		const trainer = new Trainer();
		const isMale = Math.random() < 0.5 ? true : false;
		trainer.gender = isMale ? 'male' : 'female';
		trainer.name = isMale
			? male[Math.floor(Math.random() * male.length)]
			: female[Math.floor(Math.random() * female.length)];
		await pb.collection('trainers').create(JSON.parse(JSON.stringify(trainer)));
		console.log(`Created trainer ${trainer.name}`);
		trainers.push(trainer);
	}
	const allTrainers = await pb.collection('trainers').getFullList();

	//now we grab all the pokemon and create 500 'racers' from them
	const pokemon = await pb.collection('pokemon').getFullList();
	//get 500 random pokemon
	let randomPokemon = [];
	for (let i = 0; i < 500; i++) {
		randomPokemon.push(pokemon[Math.floor(Math.random() * pokemon.length)] as unknown as Pokemon);
	}
	//sort by baseStatTotal lowest to highest
	randomPokemon.sort((a, b) => a.stats.baseStatTotal - b.stats.baseStatTotal);

	const leagues = await pb.collection('leagues').getFullList({ batch: 2000 });

	let i = 1;
	for (const pokemon of randomPokemon) {
		const isMale = Math.random() < 0.5 ? true : false;
		//here we are filtering names based on gender and starting letter
		const filteredNames = isMale
			? male.filter((name) => name.toLowerCase().startsWith(pokemon.name.charAt(0)))
			: female.filter((name) => name.toLowerCase().startsWith(pokemon.name.charAt(0)));
		//here we are selecting a random name from the filtered list
		const name: string = filteredNames[Math.floor(Math.random() * filteredNames.length)];

		const racer = new Racer();
		racer.name = name;
		racer.stats.gender = isMale ? 'male' : 'female';
		racer.pokemon = String(pokemon.id);
		racer.stats.ranking = i;
		racer.stats.level = 1;
		const leagueNo =
			i > 400 && i < 501
				? 1
				: i > 300 && i < 401
					? 2
					: i > 200 && i < 301
						? 3
						: i > 100 && i < 201
							? 4
							: 5;
		racer.league =
			leagues.find((league) => league.name === 'League ' + leagueNo)?.id || leagues[0].id;
		racer.trainer = allTrainers[Math.floor(Math.random() * allTrainers.length)].id;
		delete racer.id;
		delete racer.race;
		pb.collection('racers').create(JSON.parse(JSON.stringify(racer)));
		i++;
	}
}

export const handle = async ({ event, resolve }) => {
	//get pb instance
	event.locals.pb = new PocketBase(PUBLIC_PB_URL);
	// load the store data from the request cookie string
	event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');
	try {
		// get an up-to-date auth store state by verifying and refreshing the loaded auth model (if any)
		if (event.locals.pb.authStore.isValid) {
			await event.locals.pb.collection('users').authRefresh();
			event.locals.user = structuredClone(event.locals.pb.authStore.record);
		}
	} catch (_) {
		// clear the auth store on failed refresh
		event.locals.pb.authStore.clear();
		event.locals.user = null;
	}

	if (!event.locals.user) {
		if (event.route.id !== '/login') {
			// redirect to login if not logged in
			throw redirect(303, '/login');
		}
	}

	const response = await resolve(event);

	// // send back the default 'pb_auth' cookie to the client with the latest store state
	response.headers.append(
		'set-cookie',
		event.locals.pb.authStore.exportToCookie({ sameSite: 'Lax' })
	);

	return response;
};
