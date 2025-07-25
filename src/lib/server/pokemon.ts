import { Pokemon } from '$lib/stores/racer.svelte';
import { existsSync } from 'fs';
import { JSDOM } from 'jsdom';

class DOMParser {
	parseFromString(s: string, contentType = 'text/html') {
		return new JSDOM(s, { contentType }).window.document;
	}
}

// export async function createRandomPokemon(): Promise<Pokemon> {
// 	let pokemonId: number = -1;
// 	let pokemonObj: { id: number; name: string; url: string };
// 	let mugshot: string | undefined;
// 	let spriteSheet: string | undefined;
// 	let animData: any;
// 	let randPokemon: Pokemon | undefined;
// 	let validPokemon: boolean = false;

// 	while (!validPokemon) {
// 		pokemonId = Math.floor(Math.random() * pokemon.length);

// 		const foundPokemon = pokemon.find((p) => p.id === pokemonId);
// 		if (!foundPokemon) continue;
// 		pokemonObj = { ...foundPokemon };

// 		if (!pokemonObj) continue;
// 		mugshot = await getMugshot(pokemonId);
// 		if (!mugshot) continue;

// 		spriteSheet = await getSpriteSheet(pokemonId);
// 		if (!spriteSheet) continue;

// 		animData = await getAnimData(pokemonId);
// 		if (!animData) continue;

// 		console.log('Creating random pokemon:', pokemonId);

// 		//get stats and normalise them
// 		const stats = await getPokemonStats(pokemonObj.name);
// 		if (!stats) {
// 			continue;
// 		}
// 		const normalisedStats = normaliseStats(stats);
// 		randPokemon = new Pokemon();
// 		randPokemon.id = pokemonId;
// 		randPokemon.name = pokemonObj.name;
// 		randPokemon.mugshot = mugshot;
// 		randPokemon.spriteSheet = spriteSheet;
// 		randPokemon.animData = animData;
// 		randPokemon.types = [];
// 		randPokemon.hp = normalisedStats.hp;
// 		randPokemon.attack = normalisedStats.attack;
// 		randPokemon.defense = normalisedStats.defense;
// 		randPokemon.speed = normalisedStats.speed;

// 		validPokemon = true;

// 		const index = pokemon.indexOf(pokemonObj);
// 		pokemon.splice(index, index + 1);
// 	}

// 	if (!randPokemon) throw new Error('Failed to create random pokemon');

// 	return randPokemon;
// }

export async function getAnimData(pokemonId: number) {
	const baseURL =
		'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/refs/heads/master/sprite/';
	const formattedId = '0'.repeat(4 - pokemonId.toString().length) + pokemonId.toString();
	const fullURL = baseURL + formattedId + '/' + 'AnimData.xml';
	if (!isValidHttpUrl(fullURL)) return;

	const animDataJson = await fetch(fullURL)
		.then((r) => r.text())
		.then((text) => {
			try {
				return xmlToJson(text);
			} catch (error) {
				console.error('Failed to parse AnimData.xml:', error);
				return undefined;
			}
		});
	return animDataJson;
}

export async function getMugshot(pokemonId: number) {
	const baseURL =
		'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/refs/heads/master/portrait/';
	const formattedId = '0'.repeat(4 - pokemonId.toString().length) + pokemonId.toString();
	const fullURL = baseURL + formattedId + '/' + 'Normal.png';
	if (await checkIf404(fullURL)) return;

	const image = await fetch(fullURL);
	const blob = await image.blob();

	return blob;
}

export async function getSpriteSheet(pokemonId: number) {
	const baseURL =
		'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/refs/heads/master/sprite/';
	const formattedId = '0'.repeat(4 - pokemonId.toString().length) + pokemonId.toString();
	const fullURL = baseURL + formattedId + '/' + 'Walk-Anim.png';
	if (await checkIf404(fullURL)) return;

	const image = await fetch(fullURL);
	const blob = await image.blob();

	return blob;
}

async function getPokemonStats(nameOrId: string) {
	try {
		const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const data = await response.json();
		return {
			hp: data.stats[0].base_stat,
			attack: data.stats[1].base_stat,
			defense: data.stats[2].base_stat,
			specialAttack: data.stats[3].base_stat,
			specialDefense: data.stats[4].base_stat,
			speed: data.stats[5].base_stat
		};
	} catch (error) {
		console.error('Fetch error:', error);
	}
}

async function checkIf404(url: string) {
	try {
		const response = await fetch(url, { method: 'HEAD' }); // use HEAD to avoid downloading full content
		return response.status === 404;
	} catch (error) {
		console.error('Fetch error:', error);
		return true; // if fetch fails, treat as unreachable/404
	}
}

function normaliseStats(stats: {
	hp: number;
	attack: number;
	defense: number;
	specialAttack: number;
	specialDefense: number;
	speed: number;
}) {
	const normalisedStats = {
		hp: stats.hp,
		attack: (stats.attack + stats.specialAttack) / 2,
		defense: (stats.defense + stats.specialDefense) / 2,
		speed: stats.speed
	};
	return normalisedStats;
}

function isValidHttpUrl(string: string) {
	let url;

	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}

	return url.protocol === 'http:' || url.protocol === 'https:';
}

export function xmlToJson(xmlString: string): any {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

	function parseElement(elem: Element): any {
		const obj: any = {};

		// Handle attributes
		if (elem.attributes && elem.attributes.length > 0) {
			for (let attr of Array.from(elem.attributes)) {
				obj[`@${attr.name}`] = attr.value;
			}
		}

		// Handle children
		for (let child of Array.from(elem.children)) {
			const childName = child.nodeName;
			const childObj = parseElement(child);

			if (obj[childName]) {
				// If already exists, convert to array or push
				if (!Array.isArray(obj[childName])) {
					obj[childName] = [obj[childName]];
				}
				obj[childName].push(childObj);
			} else {
				obj[childName] = childObj;
			}
		}

		// Handle text content (if no children)
		if (elem.children.length === 0 && elem.textContent?.trim()) {
			return elem.textContent.trim();
		}

		return obj;
	}

	const root = xmlDoc.documentElement;
	return { [root.nodeName]: parseElement(root) };
}

let pokemon = [
	{
		name: 'bulbasaur',
		url: 'https://pokeapi.co/api/v2/pokemon/1/',
		id: 1
	},
	{
		name: 'ivysaur',
		url: 'https://pokeapi.co/api/v2/pokemon/2/',
		id: 2
	},
	{
		name: 'venusaur',
		url: 'https://pokeapi.co/api/v2/pokemon/3/',
		id: 3
	},
	{
		name: 'charmander',
		url: 'https://pokeapi.co/api/v2/pokemon/4/',
		id: 4
	},
	{
		name: 'charmeleon',
		url: 'https://pokeapi.co/api/v2/pokemon/5/',
		id: 5
	},
	{
		name: 'charizard',
		url: 'https://pokeapi.co/api/v2/pokemon/6/',
		id: 6
	},
	{
		name: 'squirtle',
		url: 'https://pokeapi.co/api/v2/pokemon/7/',
		id: 7
	},
	{
		name: 'wartortle',
		url: 'https://pokeapi.co/api/v2/pokemon/8/',
		id: 8
	},
	{
		name: 'blastoise',
		url: 'https://pokeapi.co/api/v2/pokemon/9/',
		id: 9
	},
	{
		name: 'caterpie',
		url: 'https://pokeapi.co/api/v2/pokemon/10/',
		id: 10
	},
	{
		name: 'metapod',
		url: 'https://pokeapi.co/api/v2/pokemon/11/',
		id: 11
	},
	{
		name: 'butterfree',
		url: 'https://pokeapi.co/api/v2/pokemon/12/',
		id: 12
	},
	{
		name: 'weedle',
		url: 'https://pokeapi.co/api/v2/pokemon/13/',
		id: 13
	},
	{
		name: 'kakuna',
		url: 'https://pokeapi.co/api/v2/pokemon/14/',
		id: 14
	},
	{
		name: 'beedrill',
		url: 'https://pokeapi.co/api/v2/pokemon/15/',
		id: 15
	},
	{
		name: 'pidgey',
		url: 'https://pokeapi.co/api/v2/pokemon/16/',
		id: 16
	},
	{
		name: 'pidgeotto',
		url: 'https://pokeapi.co/api/v2/pokemon/17/',
		id: 17
	},
	{
		name: 'pidgeot',
		url: 'https://pokeapi.co/api/v2/pokemon/18/',
		id: 18
	},
	{
		name: 'rattata',
		url: 'https://pokeapi.co/api/v2/pokemon/19/',
		id: 19
	},
	{
		name: 'raticate',
		url: 'https://pokeapi.co/api/v2/pokemon/20/',
		id: 20
	},
	{
		name: 'spearow',
		url: 'https://pokeapi.co/api/v2/pokemon/21/',
		id: 21
	},
	{
		name: 'fearow',
		url: 'https://pokeapi.co/api/v2/pokemon/22/',
		id: 22
	},
	{
		name: 'ekans',
		url: 'https://pokeapi.co/api/v2/pokemon/23/',
		id: 23
	},
	{
		name: 'arbok',
		url: 'https://pokeapi.co/api/v2/pokemon/24/',
		id: 24
	},
	{
		name: 'pikachu',
		url: 'https://pokeapi.co/api/v2/pokemon/25/',
		id: 25
	},
	{
		name: 'raichu',
		url: 'https://pokeapi.co/api/v2/pokemon/26/',
		id: 26
	},
	{
		name: 'sandshrew',
		url: 'https://pokeapi.co/api/v2/pokemon/27/',
		id: 27
	},
	{
		name: 'sandslash',
		url: 'https://pokeapi.co/api/v2/pokemon/28/',
		id: 28
	},
	{
		name: 'nidoran-f',
		url: 'https://pokeapi.co/api/v2/pokemon/29/',
		id: 29
	},
	{
		name: 'nidorina',
		url: 'https://pokeapi.co/api/v2/pokemon/30/',
		id: 30
	},
	{
		name: 'nidoqueen',
		url: 'https://pokeapi.co/api/v2/pokemon/31/',
		id: 31
	},
	{
		name: 'nidoran-m',
		url: 'https://pokeapi.co/api/v2/pokemon/32/',
		id: 32
	},
	{
		name: 'nidorino',
		url: 'https://pokeapi.co/api/v2/pokemon/33/',
		id: 33
	},
	{
		name: 'nidoking',
		url: 'https://pokeapi.co/api/v2/pokemon/34/',
		id: 34
	},
	{
		name: 'clefairy',
		url: 'https://pokeapi.co/api/v2/pokemon/35/',
		id: 35
	},
	{
		name: 'clefable',
		url: 'https://pokeapi.co/api/v2/pokemon/36/',
		id: 36
	},
	{
		name: 'vulpix',
		url: 'https://pokeapi.co/api/v2/pokemon/37/',
		id: 37
	},
	{
		name: 'ninetales',
		url: 'https://pokeapi.co/api/v2/pokemon/38/',
		id: 38
	},
	{
		name: 'jigglypuff',
		url: 'https://pokeapi.co/api/v2/pokemon/39/',
		id: 39
	},
	{
		name: 'wigglytuff',
		url: 'https://pokeapi.co/api/v2/pokemon/40/',
		id: 40
	},
	{
		name: 'zubat',
		url: 'https://pokeapi.co/api/v2/pokemon/41/',
		id: 41
	},
	{
		name: 'golbat',
		url: 'https://pokeapi.co/api/v2/pokemon/42/',
		id: 42
	},
	{
		name: 'oddish',
		url: 'https://pokeapi.co/api/v2/pokemon/43/',
		id: 43
	},
	{
		name: 'gloom',
		url: 'https://pokeapi.co/api/v2/pokemon/44/',
		id: 44
	},
	{
		name: 'vileplume',
		url: 'https://pokeapi.co/api/v2/pokemon/45/',
		id: 45
	},
	{
		name: 'paras',
		url: 'https://pokeapi.co/api/v2/pokemon/46/',
		id: 46
	},
	{
		name: 'parasect',
		url: 'https://pokeapi.co/api/v2/pokemon/47/',
		id: 47
	},
	{
		name: 'venonat',
		url: 'https://pokeapi.co/api/v2/pokemon/48/',
		id: 48
	},
	{
		name: 'venomoth',
		url: 'https://pokeapi.co/api/v2/pokemon/49/',
		id: 49
	},
	{
		name: 'diglett',
		url: 'https://pokeapi.co/api/v2/pokemon/50/',
		id: 50
	},
	{
		name: 'dugtrio',
		url: 'https://pokeapi.co/api/v2/pokemon/51/',
		id: 51
	},
	{
		name: 'meowth',
		url: 'https://pokeapi.co/api/v2/pokemon/52/',
		id: 52
	},
	{
		name: 'persian',
		url: 'https://pokeapi.co/api/v2/pokemon/53/',
		id: 53
	},
	{
		name: 'psyduck',
		url: 'https://pokeapi.co/api/v2/pokemon/54/',
		id: 54
	},
	{
		name: 'golduck',
		url: 'https://pokeapi.co/api/v2/pokemon/55/',
		id: 55
	},
	{
		name: 'mankey',
		url: 'https://pokeapi.co/api/v2/pokemon/56/',
		id: 56
	},
	{
		name: 'primeape',
		url: 'https://pokeapi.co/api/v2/pokemon/57/',
		id: 57
	},
	{
		name: 'growlithe',
		url: 'https://pokeapi.co/api/v2/pokemon/58/',
		id: 58
	},
	{
		name: 'arcanine',
		url: 'https://pokeapi.co/api/v2/pokemon/59/',
		id: 59
	},
	{
		name: 'poliwag',
		url: 'https://pokeapi.co/api/v2/pokemon/60/',
		id: 60
	},
	{
		name: 'poliwhirl',
		url: 'https://pokeapi.co/api/v2/pokemon/61/',
		id: 61
	},
	{
		name: 'poliwrath',
		url: 'https://pokeapi.co/api/v2/pokemon/62/',
		id: 62
	},
	{
		name: 'abra',
		url: 'https://pokeapi.co/api/v2/pokemon/63/',
		id: 63
	},
	{
		name: 'kadabra',
		url: 'https://pokeapi.co/api/v2/pokemon/64/',
		id: 64
	},
	{
		name: 'alakazam',
		url: 'https://pokeapi.co/api/v2/pokemon/65/',
		id: 65
	},
	{
		name: 'machop',
		url: 'https://pokeapi.co/api/v2/pokemon/66/',
		id: 66
	},
	{
		name: 'machoke',
		url: 'https://pokeapi.co/api/v2/pokemon/67/',
		id: 67
	},
	{
		name: 'machamp',
		url: 'https://pokeapi.co/api/v2/pokemon/68/',
		id: 68
	},
	{
		name: 'bellsprout',
		url: 'https://pokeapi.co/api/v2/pokemon/69/',
		id: 69
	},
	{
		name: 'weepinbell',
		url: 'https://pokeapi.co/api/v2/pokemon/70/',
		id: 70
	},
	{
		name: 'victreebel',
		url: 'https://pokeapi.co/api/v2/pokemon/71/',
		id: 71
	},
	{
		name: 'tentacool',
		url: 'https://pokeapi.co/api/v2/pokemon/72/',
		id: 72
	},
	{
		name: 'tentacruel',
		url: 'https://pokeapi.co/api/v2/pokemon/73/',
		id: 73
	},
	{
		name: 'geodude',
		url: 'https://pokeapi.co/api/v2/pokemon/74/',
		id: 74
	},
	{
		name: 'graveler',
		url: 'https://pokeapi.co/api/v2/pokemon/75/',
		id: 75
	},
	{
		name: 'golem',
		url: 'https://pokeapi.co/api/v2/pokemon/76/',
		id: 76
	},
	{
		name: 'ponyta',
		url: 'https://pokeapi.co/api/v2/pokemon/77/',
		id: 77
	},
	{
		name: 'rapidash',
		url: 'https://pokeapi.co/api/v2/pokemon/78/',
		id: 78
	},
	{
		name: 'slowpoke',
		url: 'https://pokeapi.co/api/v2/pokemon/79/',
		id: 79
	},
	{
		name: 'slowbro',
		url: 'https://pokeapi.co/api/v2/pokemon/80/',
		id: 80
	},
	{
		name: 'magnemite',
		url: 'https://pokeapi.co/api/v2/pokemon/81/',
		id: 81
	},
	{
		name: 'magneton',
		url: 'https://pokeapi.co/api/v2/pokemon/82/',
		id: 82
	},
	{
		name: 'farfetchd',
		url: 'https://pokeapi.co/api/v2/pokemon/83/',
		id: 83
	},
	{
		name: 'doduo',
		url: 'https://pokeapi.co/api/v2/pokemon/84/',
		id: 84
	},
	{
		name: 'dodrio',
		url: 'https://pokeapi.co/api/v2/pokemon/85/',
		id: 85
	},
	{
		name: 'seel',
		url: 'https://pokeapi.co/api/v2/pokemon/86/',
		id: 86
	},
	{
		name: 'dewgong',
		url: 'https://pokeapi.co/api/v2/pokemon/87/',
		id: 87
	},
	{
		name: 'grimer',
		url: 'https://pokeapi.co/api/v2/pokemon/88/',
		id: 88
	},
	{
		name: 'muk',
		url: 'https://pokeapi.co/api/v2/pokemon/89/',
		id: 89
	},
	{
		name: 'shellder',
		url: 'https://pokeapi.co/api/v2/pokemon/90/',
		id: 90
	},
	{
		name: 'cloyster',
		url: 'https://pokeapi.co/api/v2/pokemon/91/',
		id: 91
	},
	{
		name: 'gastly',
		url: 'https://pokeapi.co/api/v2/pokemon/92/',
		id: 92
	},
	{
		name: 'haunter',
		url: 'https://pokeapi.co/api/v2/pokemon/93/',
		id: 93
	},
	{
		name: 'gengar',
		url: 'https://pokeapi.co/api/v2/pokemon/94/',
		id: 94
	},
	{
		name: 'onix',
		url: 'https://pokeapi.co/api/v2/pokemon/95/',
		id: 95
	},
	{
		name: 'drowzee',
		url: 'https://pokeapi.co/api/v2/pokemon/96/',
		id: 96
	},
	{
		name: 'hypno',
		url: 'https://pokeapi.co/api/v2/pokemon/97/',
		id: 97
	},
	{
		name: 'krabby',
		url: 'https://pokeapi.co/api/v2/pokemon/98/',
		id: 98
	},
	{
		name: 'kingler',
		url: 'https://pokeapi.co/api/v2/pokemon/99/',
		id: 99
	},
	{
		name: 'voltorb',
		url: 'https://pokeapi.co/api/v2/pokemon/100/',
		id: 100
	},
	{
		name: 'electrode',
		url: 'https://pokeapi.co/api/v2/pokemon/101/',
		id: 101
	},
	{
		name: 'exeggcute',
		url: 'https://pokeapi.co/api/v2/pokemon/102/',
		id: 102
	},
	{
		name: 'exeggutor',
		url: 'https://pokeapi.co/api/v2/pokemon/103/',
		id: 103
	},
	{
		name: 'cubone',
		url: 'https://pokeapi.co/api/v2/pokemon/104/',
		id: 104
	},
	{
		name: 'marowak',
		url: 'https://pokeapi.co/api/v2/pokemon/105/',
		id: 105
	},
	{
		name: 'hitmonlee',
		url: 'https://pokeapi.co/api/v2/pokemon/106/',
		id: 106
	},
	{
		name: 'hitmonchan',
		url: 'https://pokeapi.co/api/v2/pokemon/107/',
		id: 107
	},
	{
		name: 'lickitung',
		url: 'https://pokeapi.co/api/v2/pokemon/108/',
		id: 108
	},
	{
		name: 'koffing',
		url: 'https://pokeapi.co/api/v2/pokemon/109/',
		id: 109
	},
	{
		name: 'weezing',
		url: 'https://pokeapi.co/api/v2/pokemon/110/',
		id: 110
	},
	{
		name: 'rhyhorn',
		url: 'https://pokeapi.co/api/v2/pokemon/111/',
		id: 111
	},
	{
		name: 'rhydon',
		url: 'https://pokeapi.co/api/v2/pokemon/112/',
		id: 112
	},
	{
		name: 'chansey',
		url: 'https://pokeapi.co/api/v2/pokemon/113/',
		id: 113
	},
	{
		name: 'tangela',
		url: 'https://pokeapi.co/api/v2/pokemon/114/',
		id: 114
	},
	{
		name: 'kangaskhan',
		url: 'https://pokeapi.co/api/v2/pokemon/115/',
		id: 115
	},
	{
		name: 'horsea',
		url: 'https://pokeapi.co/api/v2/pokemon/116/',
		id: 116
	},
	{
		name: 'seadra',
		url: 'https://pokeapi.co/api/v2/pokemon/117/',
		id: 117
	},
	{
		name: 'goldeen',
		url: 'https://pokeapi.co/api/v2/pokemon/118/',
		id: 118
	},
	{
		name: 'seaking',
		url: 'https://pokeapi.co/api/v2/pokemon/119/',
		id: 119
	},
	{
		name: 'staryu',
		url: 'https://pokeapi.co/api/v2/pokemon/120/',
		id: 120
	},
	{
		name: 'starmie',
		url: 'https://pokeapi.co/api/v2/pokemon/121/',
		id: 121
	},
	{
		name: 'mr-mime',
		url: 'https://pokeapi.co/api/v2/pokemon/122/',
		id: 122
	},
	{
		name: 'scyther',
		url: 'https://pokeapi.co/api/v2/pokemon/123/',
		id: 123
	},
	{
		name: 'jynx',
		url: 'https://pokeapi.co/api/v2/pokemon/124/',
		id: 124
	},
	{
		name: 'electabuzz',
		url: 'https://pokeapi.co/api/v2/pokemon/125/',
		id: 125
	},
	{
		name: 'magmar',
		url: 'https://pokeapi.co/api/v2/pokemon/126/',
		id: 126
	},
	{
		name: 'pinsir',
		url: 'https://pokeapi.co/api/v2/pokemon/127/',
		id: 127
	},
	{
		name: 'tauros',
		url: 'https://pokeapi.co/api/v2/pokemon/128/',
		id: 128
	},
	{
		name: 'magikarp',
		url: 'https://pokeapi.co/api/v2/pokemon/129/',
		id: 129
	},
	{
		name: 'gyarados',
		url: 'https://pokeapi.co/api/v2/pokemon/130/',
		id: 130
	},
	{
		name: 'lapras',
		url: 'https://pokeapi.co/api/v2/pokemon/131/',
		id: 131
	},
	{
		name: 'ditto',
		url: 'https://pokeapi.co/api/v2/pokemon/132/',
		id: 132
	},
	{
		name: 'eevee',
		url: 'https://pokeapi.co/api/v2/pokemon/133/',
		id: 133
	},
	{
		name: 'vaporeon',
		url: 'https://pokeapi.co/api/v2/pokemon/134/',
		id: 134
	},
	{
		name: 'jolteon',
		url: 'https://pokeapi.co/api/v2/pokemon/135/',
		id: 135
	},
	{
		name: 'flareon',
		url: 'https://pokeapi.co/api/v2/pokemon/136/',
		id: 136
	},
	{
		name: 'porygon',
		url: 'https://pokeapi.co/api/v2/pokemon/137/',
		id: 137
	},
	{
		name: 'omanyte',
		url: 'https://pokeapi.co/api/v2/pokemon/138/',
		id: 138
	},
	{
		name: 'omastar',
		url: 'https://pokeapi.co/api/v2/pokemon/139/',
		id: 139
	},
	{
		name: 'kabuto',
		url: 'https://pokeapi.co/api/v2/pokemon/140/',
		id: 140
	},
	{
		name: 'kabutops',
		url: 'https://pokeapi.co/api/v2/pokemon/141/',
		id: 141
	},
	{
		name: 'aerodactyl',
		url: 'https://pokeapi.co/api/v2/pokemon/142/',
		id: 142
	},
	{
		name: 'snorlax',
		url: 'https://pokeapi.co/api/v2/pokemon/143/',
		id: 143
	},
	{
		name: 'articuno',
		url: 'https://pokeapi.co/api/v2/pokemon/144/',
		id: 144
	},
	{
		name: 'zapdos',
		url: 'https://pokeapi.co/api/v2/pokemon/145/',
		id: 145
	},
	{
		name: 'moltres',
		url: 'https://pokeapi.co/api/v2/pokemon/146/',
		id: 146
	},
	{
		name: 'dratini',
		url: 'https://pokeapi.co/api/v2/pokemon/147/',
		id: 147
	},
	{
		name: 'dragonair',
		url: 'https://pokeapi.co/api/v2/pokemon/148/',
		id: 148
	},
	{
		name: 'dragonite',
		url: 'https://pokeapi.co/api/v2/pokemon/149/',
		id: 149
	},
	{
		name: 'mewtwo',
		url: 'https://pokeapi.co/api/v2/pokemon/150/',
		id: 150
	},
	{
		name: 'mew',
		url: 'https://pokeapi.co/api/v2/pokemon/151/',
		id: 151
	},
	{
		name: 'chikorita',
		url: 'https://pokeapi.co/api/v2/pokemon/152/',
		id: 152
	},
	{
		name: 'bayleef',
		url: 'https://pokeapi.co/api/v2/pokemon/153/',
		id: 153
	},
	{
		name: 'meganium',
		url: 'https://pokeapi.co/api/v2/pokemon/154/',
		id: 154
	},
	{
		name: 'cyndaquil',
		url: 'https://pokeapi.co/api/v2/pokemon/155/',
		id: 155
	},
	{
		name: 'quilava',
		url: 'https://pokeapi.co/api/v2/pokemon/156/',
		id: 156
	},
	{
		name: 'typhlosion',
		url: 'https://pokeapi.co/api/v2/pokemon/157/',
		id: 157
	},
	{
		name: 'totodile',
		url: 'https://pokeapi.co/api/v2/pokemon/158/',
		id: 158
	},
	{
		name: 'croconaw',
		url: 'https://pokeapi.co/api/v2/pokemon/159/',
		id: 159
	},
	{
		name: 'feraligatr',
		url: 'https://pokeapi.co/api/v2/pokemon/160/',
		id: 160
	},
	{
		name: 'sentret',
		url: 'https://pokeapi.co/api/v2/pokemon/161/',
		id: 161
	},
	{
		name: 'furret',
		url: 'https://pokeapi.co/api/v2/pokemon/162/',
		id: 162
	},
	{
		name: 'hoothoot',
		url: 'https://pokeapi.co/api/v2/pokemon/163/',
		id: 163
	},
	{
		name: 'noctowl',
		url: 'https://pokeapi.co/api/v2/pokemon/164/',
		id: 164
	},
	{
		name: 'ledyba',
		url: 'https://pokeapi.co/api/v2/pokemon/165/',
		id: 165
	},
	{
		name: 'ledian',
		url: 'https://pokeapi.co/api/v2/pokemon/166/',
		id: 166
	},
	{
		name: 'spinarak',
		url: 'https://pokeapi.co/api/v2/pokemon/167/',
		id: 167
	},
	{
		name: 'ariados',
		url: 'https://pokeapi.co/api/v2/pokemon/168/',
		id: 168
	},
	{
		name: 'crobat',
		url: 'https://pokeapi.co/api/v2/pokemon/169/',
		id: 169
	},
	{
		name: 'chinchou',
		url: 'https://pokeapi.co/api/v2/pokemon/170/',
		id: 170
	},
	{
		name: 'lanturn',
		url: 'https://pokeapi.co/api/v2/pokemon/171/',
		id: 171
	},
	{
		name: 'pichu',
		url: 'https://pokeapi.co/api/v2/pokemon/172/',
		id: 172
	},
	{
		name: 'cleffa',
		url: 'https://pokeapi.co/api/v2/pokemon/173/',
		id: 173
	},
	{
		name: 'igglybuff',
		url: 'https://pokeapi.co/api/v2/pokemon/174/',
		id: 174
	},
	{
		name: 'togepi',
		url: 'https://pokeapi.co/api/v2/pokemon/175/',
		id: 175
	},
	{
		name: 'togetic',
		url: 'https://pokeapi.co/api/v2/pokemon/176/',
		id: 176
	},
	{
		name: 'natu',
		url: 'https://pokeapi.co/api/v2/pokemon/177/',
		id: 177
	},
	{
		name: 'xatu',
		url: 'https://pokeapi.co/api/v2/pokemon/178/',
		id: 178
	},
	{
		name: 'mareep',
		url: 'https://pokeapi.co/api/v2/pokemon/179/',
		id: 179
	},
	{
		name: 'flaaffy',
		url: 'https://pokeapi.co/api/v2/pokemon/180/',
		id: 180
	},
	{
		name: 'ampharos',
		url: 'https://pokeapi.co/api/v2/pokemon/181/',
		id: 181
	},
	{
		name: 'bellossom',
		url: 'https://pokeapi.co/api/v2/pokemon/182/',
		id: 182
	},
	{
		name: 'marill',
		url: 'https://pokeapi.co/api/v2/pokemon/183/',
		id: 183
	},
	{
		name: 'azumarill',
		url: 'https://pokeapi.co/api/v2/pokemon/184/',
		id: 184
	},
	{
		name: 'sudowoodo',
		url: 'https://pokeapi.co/api/v2/pokemon/185/',
		id: 185
	},
	{
		name: 'politoed',
		url: 'https://pokeapi.co/api/v2/pokemon/186/',
		id: 186
	},
	{
		name: 'hoppip',
		url: 'https://pokeapi.co/api/v2/pokemon/187/',
		id: 187
	},
	{
		name: 'skiploom',
		url: 'https://pokeapi.co/api/v2/pokemon/188/',
		id: 188
	},
	{
		name: 'jumpluff',
		url: 'https://pokeapi.co/api/v2/pokemon/189/',
		id: 189
	},
	{
		name: 'aipom',
		url: 'https://pokeapi.co/api/v2/pokemon/190/',
		id: 190
	},
	{
		name: 'sunkern',
		url: 'https://pokeapi.co/api/v2/pokemon/191/',
		id: 191
	},
	{
		name: 'sunflora',
		url: 'https://pokeapi.co/api/v2/pokemon/192/',
		id: 192
	},
	{
		name: 'yanma',
		url: 'https://pokeapi.co/api/v2/pokemon/193/',
		id: 193
	},
	{
		name: 'wooper',
		url: 'https://pokeapi.co/api/v2/pokemon/194/',
		id: 194
	},
	{
		name: 'quagsire',
		url: 'https://pokeapi.co/api/v2/pokemon/195/',
		id: 195
	},
	{
		name: 'espeon',
		url: 'https://pokeapi.co/api/v2/pokemon/196/',
		id: 196
	},
	{
		name: 'umbreon',
		url: 'https://pokeapi.co/api/v2/pokemon/197/',
		id: 197
	},
	{
		name: 'murkrow',
		url: 'https://pokeapi.co/api/v2/pokemon/198/',
		id: 198
	},
	{
		name: 'slowking',
		url: 'https://pokeapi.co/api/v2/pokemon/199/',
		id: 199
	},
	{
		name: 'misdreavus',
		url: 'https://pokeapi.co/api/v2/pokemon/200/',
		id: 200
	},
	{
		name: 'unown',
		url: 'https://pokeapi.co/api/v2/pokemon/201/',
		id: 201
	},
	{
		name: 'wobbuffet',
		url: 'https://pokeapi.co/api/v2/pokemon/202/',
		id: 202
	},
	{
		name: 'girafarig',
		url: 'https://pokeapi.co/api/v2/pokemon/203/',
		id: 203
	},
	{
		name: 'pineco',
		url: 'https://pokeapi.co/api/v2/pokemon/204/',
		id: 204
	},
	{
		name: 'forretress',
		url: 'https://pokeapi.co/api/v2/pokemon/205/',
		id: 205
	},
	{
		name: 'dunsparce',
		url: 'https://pokeapi.co/api/v2/pokemon/206/',
		id: 206
	},
	{
		name: 'gligar',
		url: 'https://pokeapi.co/api/v2/pokemon/207/',
		id: 207
	},
	{
		name: 'steelix',
		url: 'https://pokeapi.co/api/v2/pokemon/208/',
		id: 208
	},
	{
		name: 'snubbull',
		url: 'https://pokeapi.co/api/v2/pokemon/209/',
		id: 209
	},
	{
		name: 'granbull',
		url: 'https://pokeapi.co/api/v2/pokemon/210/',
		id: 210
	},
	{
		name: 'qwilfish',
		url: 'https://pokeapi.co/api/v2/pokemon/211/',
		id: 211
	},
	{
		name: 'scizor',
		url: 'https://pokeapi.co/api/v2/pokemon/212/',
		id: 212
	},
	{
		name: 'shuckle',
		url: 'https://pokeapi.co/api/v2/pokemon/213/',
		id: 213
	},
	{
		name: 'heracross',
		url: 'https://pokeapi.co/api/v2/pokemon/214/',
		id: 214
	},
	{
		name: 'sneasel',
		url: 'https://pokeapi.co/api/v2/pokemon/215/',
		id: 215
	},
	{
		name: 'teddiursa',
		url: 'https://pokeapi.co/api/v2/pokemon/216/',
		id: 216
	},
	{
		name: 'ursaring',
		url: 'https://pokeapi.co/api/v2/pokemon/217/',
		id: 217
	},
	{
		name: 'slugma',
		url: 'https://pokeapi.co/api/v2/pokemon/218/',
		id: 218
	},
	{
		name: 'magcargo',
		url: 'https://pokeapi.co/api/v2/pokemon/219/',
		id: 219
	},
	{
		name: 'swinub',
		url: 'https://pokeapi.co/api/v2/pokemon/220/',
		id: 220
	},
	{
		name: 'piloswine',
		url: 'https://pokeapi.co/api/v2/pokemon/221/',
		id: 221
	},
	{
		name: 'corsola',
		url: 'https://pokeapi.co/api/v2/pokemon/222/',
		id: 222
	},
	{
		name: 'remoraid',
		url: 'https://pokeapi.co/api/v2/pokemon/223/',
		id: 223
	},
	{
		name: 'octillery',
		url: 'https://pokeapi.co/api/v2/pokemon/224/',
		id: 224
	},
	{
		name: 'delibird',
		url: 'https://pokeapi.co/api/v2/pokemon/225/',
		id: 225
	},
	{
		name: 'mantine',
		url: 'https://pokeapi.co/api/v2/pokemon/226/',
		id: 226
	},
	{
		name: 'skarmory',
		url: 'https://pokeapi.co/api/v2/pokemon/227/',
		id: 227
	},
	{
		name: 'houndour',
		url: 'https://pokeapi.co/api/v2/pokemon/228/',
		id: 228
	},
	{
		name: 'houndoom',
		url: 'https://pokeapi.co/api/v2/pokemon/229/',
		id: 229
	},
	{
		name: 'kingdra',
		url: 'https://pokeapi.co/api/v2/pokemon/230/',
		id: 230
	},
	{
		name: 'phanpy',
		url: 'https://pokeapi.co/api/v2/pokemon/231/',
		id: 231
	},
	{
		name: 'donphan',
		url: 'https://pokeapi.co/api/v2/pokemon/232/',
		id: 232
	},
	{
		name: 'porygon2',
		url: 'https://pokeapi.co/api/v2/pokemon/233/',
		id: 233
	},
	{
		name: 'stantler',
		url: 'https://pokeapi.co/api/v2/pokemon/234/',
		id: 234
	},
	{
		name: 'smeargle',
		url: 'https://pokeapi.co/api/v2/pokemon/235/',
		id: 235
	},
	{
		name: 'tyrogue',
		url: 'https://pokeapi.co/api/v2/pokemon/236/',
		id: 236
	},
	{
		name: 'hitmontop',
		url: 'https://pokeapi.co/api/v2/pokemon/237/',
		id: 237
	},
	{
		name: 'smoochum',
		url: 'https://pokeapi.co/api/v2/pokemon/238/',
		id: 238
	},
	{
		name: 'elekid',
		url: 'https://pokeapi.co/api/v2/pokemon/239/',
		id: 239
	},
	{
		name: 'magby',
		url: 'https://pokeapi.co/api/v2/pokemon/240/',
		id: 240
	},
	{
		name: 'miltank',
		url: 'https://pokeapi.co/api/v2/pokemon/241/',
		id: 241
	},
	{
		name: 'blissey',
		url: 'https://pokeapi.co/api/v2/pokemon/242/',
		id: 242
	},
	{
		name: 'raikou',
		url: 'https://pokeapi.co/api/v2/pokemon/243/',
		id: 243
	},
	{
		name: 'entei',
		url: 'https://pokeapi.co/api/v2/pokemon/244/',
		id: 244
	},
	{
		name: 'suicune',
		url: 'https://pokeapi.co/api/v2/pokemon/245/',
		id: 245
	},
	{
		name: 'larvitar',
		url: 'https://pokeapi.co/api/v2/pokemon/246/',
		id: 246
	},
	{
		name: 'pupitar',
		url: 'https://pokeapi.co/api/v2/pokemon/247/',
		id: 247
	},
	{
		name: 'tyranitar',
		url: 'https://pokeapi.co/api/v2/pokemon/248/',
		id: 248
	},
	{
		name: 'lugia',
		url: 'https://pokeapi.co/api/v2/pokemon/249/',
		id: 249
	},
	{
		name: 'ho-oh',
		url: 'https://pokeapi.co/api/v2/pokemon/250/',
		id: 250
	},
	{
		name: 'celebi',
		url: 'https://pokeapi.co/api/v2/pokemon/251/',
		id: 251
	},
	{
		name: 'treecko',
		url: 'https://pokeapi.co/api/v2/pokemon/252/',
		id: 252
	},
	{
		name: 'grovyle',
		url: 'https://pokeapi.co/api/v2/pokemon/253/',
		id: 253
	},
	{
		name: 'sceptile',
		url: 'https://pokeapi.co/api/v2/pokemon/254/',
		id: 254
	},
	{
		name: 'torchic',
		url: 'https://pokeapi.co/api/v2/pokemon/255/',
		id: 255
	},
	{
		name: 'combusken',
		url: 'https://pokeapi.co/api/v2/pokemon/256/',
		id: 256
	},
	{
		name: 'blaziken',
		url: 'https://pokeapi.co/api/v2/pokemon/257/',
		id: 257
	},
	{
		name: 'mudkip',
		url: 'https://pokeapi.co/api/v2/pokemon/258/',
		id: 258
	},
	{
		name: 'marshtomp',
		url: 'https://pokeapi.co/api/v2/pokemon/259/',
		id: 259
	},
	{
		name: 'swampert',
		url: 'https://pokeapi.co/api/v2/pokemon/260/',
		id: 260
	},
	{
		name: 'poochyena',
		url: 'https://pokeapi.co/api/v2/pokemon/261/',
		id: 261
	},
	{
		name: 'mightyena',
		url: 'https://pokeapi.co/api/v2/pokemon/262/',
		id: 262
	},
	{
		name: 'zigzagoon',
		url: 'https://pokeapi.co/api/v2/pokemon/263/',
		id: 263
	},
	{
		name: 'linoone',
		url: 'https://pokeapi.co/api/v2/pokemon/264/',
		id: 264
	},
	{
		name: 'wurmple',
		url: 'https://pokeapi.co/api/v2/pokemon/265/',
		id: 265
	},
	{
		name: 'silcoon',
		url: 'https://pokeapi.co/api/v2/pokemon/266/',
		id: 266
	},
	{
		name: 'beautifly',
		url: 'https://pokeapi.co/api/v2/pokemon/267/',
		id: 267
	},
	{
		name: 'cascoon',
		url: 'https://pokeapi.co/api/v2/pokemon/268/',
		id: 268
	},
	{
		name: 'dustox',
		url: 'https://pokeapi.co/api/v2/pokemon/269/',
		id: 269
	},
	{
		name: 'lotad',
		url: 'https://pokeapi.co/api/v2/pokemon/270/',
		id: 270
	},
	{
		name: 'lombre',
		url: 'https://pokeapi.co/api/v2/pokemon/271/',
		id: 271
	},
	{
		name: 'ludicolo',
		url: 'https://pokeapi.co/api/v2/pokemon/272/',
		id: 272
	},
	{
		name: 'seedot',
		url: 'https://pokeapi.co/api/v2/pokemon/273/',
		id: 273
	},
	{
		name: 'nuzleaf',
		url: 'https://pokeapi.co/api/v2/pokemon/274/',
		id: 274
	},
	{
		name: 'shiftry',
		url: 'https://pokeapi.co/api/v2/pokemon/275/',
		id: 275
	},
	{
		name: 'taillow',
		url: 'https://pokeapi.co/api/v2/pokemon/276/',
		id: 276
	},
	{
		name: 'swellow',
		url: 'https://pokeapi.co/api/v2/pokemon/277/',
		id: 277
	},
	{
		name: 'wingull',
		url: 'https://pokeapi.co/api/v2/pokemon/278/',
		id: 278
	},
	{
		name: 'pelipper',
		url: 'https://pokeapi.co/api/v2/pokemon/279/',
		id: 279
	},
	{
		name: 'ralts',
		url: 'https://pokeapi.co/api/v2/pokemon/280/',
		id: 280
	},
	{
		name: 'kirlia',
		url: 'https://pokeapi.co/api/v2/pokemon/281/',
		id: 281
	},
	{
		name: 'gardevoir',
		url: 'https://pokeapi.co/api/v2/pokemon/282/',
		id: 282
	},
	{
		name: 'surskit',
		url: 'https://pokeapi.co/api/v2/pokemon/283/',
		id: 283
	},
	{
		name: 'masquerain',
		url: 'https://pokeapi.co/api/v2/pokemon/284/',
		id: 284
	},
	{
		name: 'shroomish',
		url: 'https://pokeapi.co/api/v2/pokemon/285/',
		id: 285
	},
	{
		name: 'breloom',
		url: 'https://pokeapi.co/api/v2/pokemon/286/',
		id: 286
	},
	{
		name: 'slakoth',
		url: 'https://pokeapi.co/api/v2/pokemon/287/',
		id: 287
	},
	{
		name: 'vigoroth',
		url: 'https://pokeapi.co/api/v2/pokemon/288/',
		id: 288
	},
	{
		name: 'slaking',
		url: 'https://pokeapi.co/api/v2/pokemon/289/',
		id: 289
	},
	{
		name: 'nincada',
		url: 'https://pokeapi.co/api/v2/pokemon/290/',
		id: 290
	},
	{
		name: 'ninjask',
		url: 'https://pokeapi.co/api/v2/pokemon/291/',
		id: 291
	},
	{
		name: 'shedinja',
		url: 'https://pokeapi.co/api/v2/pokemon/292/',
		id: 292
	},
	{
		name: 'whismur',
		url: 'https://pokeapi.co/api/v2/pokemon/293/',
		id: 293
	},
	{
		name: 'loudred',
		url: 'https://pokeapi.co/api/v2/pokemon/294/',
		id: 294
	},
	{
		name: 'exploud',
		url: 'https://pokeapi.co/api/v2/pokemon/295/',
		id: 295
	},
	{
		name: 'makuhita',
		url: 'https://pokeapi.co/api/v2/pokemon/296/',
		id: 296
	},
	{
		name: 'hariyama',
		url: 'https://pokeapi.co/api/v2/pokemon/297/',
		id: 297
	},
	{
		name: 'azurill',
		url: 'https://pokeapi.co/api/v2/pokemon/298/',
		id: 298
	},
	{
		name: 'nosepass',
		url: 'https://pokeapi.co/api/v2/pokemon/299/',
		id: 299
	},
	{
		name: 'skitty',
		url: 'https://pokeapi.co/api/v2/pokemon/300/',
		id: 300
	},
	{
		name: 'delcatty',
		url: 'https://pokeapi.co/api/v2/pokemon/301/',
		id: 301
	},
	{
		name: 'sableye',
		url: 'https://pokeapi.co/api/v2/pokemon/302/',
		id: 302
	},
	{
		name: 'mawile',
		url: 'https://pokeapi.co/api/v2/pokemon/303/',
		id: 303
	},
	{
		name: 'aron',
		url: 'https://pokeapi.co/api/v2/pokemon/304/',
		id: 304
	},
	{
		name: 'lairon',
		url: 'https://pokeapi.co/api/v2/pokemon/305/',
		id: 305
	},
	{
		name: 'aggron',
		url: 'https://pokeapi.co/api/v2/pokemon/306/',
		id: 306
	},
	{
		name: 'meditite',
		url: 'https://pokeapi.co/api/v2/pokemon/307/',
		id: 307
	},
	{
		name: 'medicham',
		url: 'https://pokeapi.co/api/v2/pokemon/308/',
		id: 308
	},
	{
		name: 'electrike',
		url: 'https://pokeapi.co/api/v2/pokemon/309/',
		id: 309
	},
	{
		name: 'manectric',
		url: 'https://pokeapi.co/api/v2/pokemon/310/',
		id: 310
	},
	{
		name: 'plusle',
		url: 'https://pokeapi.co/api/v2/pokemon/311/',
		id: 311
	},
	{
		name: 'minun',
		url: 'https://pokeapi.co/api/v2/pokemon/312/',
		id: 312
	},
	{
		name: 'volbeat',
		url: 'https://pokeapi.co/api/v2/pokemon/313/',
		id: 313
	},
	{
		name: 'illumise',
		url: 'https://pokeapi.co/api/v2/pokemon/314/',
		id: 314
	},
	{
		name: 'roselia',
		url: 'https://pokeapi.co/api/v2/pokemon/315/',
		id: 315
	},
	{
		name: 'gulpin',
		url: 'https://pokeapi.co/api/v2/pokemon/316/',
		id: 316
	},
	{
		name: 'swalot',
		url: 'https://pokeapi.co/api/v2/pokemon/317/',
		id: 317
	},
	{
		name: 'carvanha',
		url: 'https://pokeapi.co/api/v2/pokemon/318/',
		id: 318
	},
	{
		name: 'sharpedo',
		url: 'https://pokeapi.co/api/v2/pokemon/319/',
		id: 319
	},
	{
		name: 'wailmer',
		url: 'https://pokeapi.co/api/v2/pokemon/320/',
		id: 320
	},
	{
		name: 'wailord',
		url: 'https://pokeapi.co/api/v2/pokemon/321/',
		id: 321
	},
	{
		name: 'numel',
		url: 'https://pokeapi.co/api/v2/pokemon/322/',
		id: 322
	},
	{
		name: 'camerupt',
		url: 'https://pokeapi.co/api/v2/pokemon/323/',
		id: 323
	},
	{
		name: 'torkoal',
		url: 'https://pokeapi.co/api/v2/pokemon/324/',
		id: 324
	},
	{
		name: 'spoink',
		url: 'https://pokeapi.co/api/v2/pokemon/325/',
		id: 325
	},
	{
		name: 'grumpig',
		url: 'https://pokeapi.co/api/v2/pokemon/326/',
		id: 326
	},
	{
		name: 'spinda',
		url: 'https://pokeapi.co/api/v2/pokemon/327/',
		id: 327
	},
	{
		name: 'trapinch',
		url: 'https://pokeapi.co/api/v2/pokemon/328/',
		id: 328
	},
	{
		name: 'vibrava',
		url: 'https://pokeapi.co/api/v2/pokemon/329/',
		id: 329
	},
	{
		name: 'flygon',
		url: 'https://pokeapi.co/api/v2/pokemon/330/',
		id: 330
	},
	{
		name: 'cacnea',
		url: 'https://pokeapi.co/api/v2/pokemon/331/',
		id: 331
	},
	{
		name: 'cacturne',
		url: 'https://pokeapi.co/api/v2/pokemon/332/',
		id: 332
	},
	{
		name: 'swablu',
		url: 'https://pokeapi.co/api/v2/pokemon/333/',
		id: 333
	},
	{
		name: 'altaria',
		url: 'https://pokeapi.co/api/v2/pokemon/334/',
		id: 334
	},
	{
		name: 'zangoose',
		url: 'https://pokeapi.co/api/v2/pokemon/335/',
		id: 335
	},
	{
		name: 'seviper',
		url: 'https://pokeapi.co/api/v2/pokemon/336/',
		id: 336
	},
	{
		name: 'lunatone',
		url: 'https://pokeapi.co/api/v2/pokemon/337/',
		id: 337
	},
	{
		name: 'solrock',
		url: 'https://pokeapi.co/api/v2/pokemon/338/',
		id: 338
	},
	{
		name: 'barboach',
		url: 'https://pokeapi.co/api/v2/pokemon/339/',
		id: 339
	},
	{
		name: 'whiscash',
		url: 'https://pokeapi.co/api/v2/pokemon/340/',
		id: 340
	},
	{
		name: 'corphish',
		url: 'https://pokeapi.co/api/v2/pokemon/341/',
		id: 341
	},
	{
		name: 'crawdaunt',
		url: 'https://pokeapi.co/api/v2/pokemon/342/',
		id: 342
	},
	{
		name: 'baltoy',
		url: 'https://pokeapi.co/api/v2/pokemon/343/',
		id: 343
	},
	{
		name: 'claydol',
		url: 'https://pokeapi.co/api/v2/pokemon/344/',
		id: 344
	},
	{
		name: 'lileep',
		url: 'https://pokeapi.co/api/v2/pokemon/345/',
		id: 345
	},
	{
		name: 'cradily',
		url: 'https://pokeapi.co/api/v2/pokemon/346/',
		id: 346
	},
	{
		name: 'anorith',
		url: 'https://pokeapi.co/api/v2/pokemon/347/',
		id: 347
	},
	{
		name: 'armaldo',
		url: 'https://pokeapi.co/api/v2/pokemon/348/',
		id: 348
	},
	{
		name: 'feebas',
		url: 'https://pokeapi.co/api/v2/pokemon/349/',
		id: 349
	},
	{
		name: 'milotic',
		url: 'https://pokeapi.co/api/v2/pokemon/350/',
		id: 350
	},
	{
		name: 'castform',
		url: 'https://pokeapi.co/api/v2/pokemon/351/',
		id: 351
	},
	{
		name: 'kecleon',
		url: 'https://pokeapi.co/api/v2/pokemon/352/',
		id: 352
	},
	{
		name: 'shuppet',
		url: 'https://pokeapi.co/api/v2/pokemon/353/',
		id: 353
	},
	{
		name: 'banette',
		url: 'https://pokeapi.co/api/v2/pokemon/354/',
		id: 354
	},
	{
		name: 'duskull',
		url: 'https://pokeapi.co/api/v2/pokemon/355/',
		id: 355
	},
	{
		name: 'dusclops',
		url: 'https://pokeapi.co/api/v2/pokemon/356/',
		id: 356
	},
	{
		name: 'tropius',
		url: 'https://pokeapi.co/api/v2/pokemon/357/',
		id: 357
	},
	{
		name: 'chimecho',
		url: 'https://pokeapi.co/api/v2/pokemon/358/',
		id: 358
	},
	{
		name: 'absol',
		url: 'https://pokeapi.co/api/v2/pokemon/359/',
		id: 359
	},
	{
		name: 'wynaut',
		url: 'https://pokeapi.co/api/v2/pokemon/360/',
		id: 360
	},
	{
		name: 'snorunt',
		url: 'https://pokeapi.co/api/v2/pokemon/361/',
		id: 361
	},
	{
		name: 'glalie',
		url: 'https://pokeapi.co/api/v2/pokemon/362/',
		id: 362
	},
	{
		name: 'spheal',
		url: 'https://pokeapi.co/api/v2/pokemon/363/',
		id: 363
	},
	{
		name: 'sealeo',
		url: 'https://pokeapi.co/api/v2/pokemon/364/',
		id: 364
	},
	{
		name: 'walrein',
		url: 'https://pokeapi.co/api/v2/pokemon/365/',
		id: 365
	},
	{
		name: 'clamperl',
		url: 'https://pokeapi.co/api/v2/pokemon/366/',
		id: 366
	},
	{
		name: 'huntail',
		url: 'https://pokeapi.co/api/v2/pokemon/367/',
		id: 367
	},
	{
		name: 'gorebyss',
		url: 'https://pokeapi.co/api/v2/pokemon/368/',
		id: 368
	},
	{
		name: 'relicanth',
		url: 'https://pokeapi.co/api/v2/pokemon/369/',
		id: 369
	},
	{
		name: 'luvdisc',
		url: 'https://pokeapi.co/api/v2/pokemon/370/',
		id: 370
	},
	{
		name: 'bagon',
		url: 'https://pokeapi.co/api/v2/pokemon/371/',
		id: 371
	},
	{
		name: 'shelgon',
		url: 'https://pokeapi.co/api/v2/pokemon/372/',
		id: 372
	},
	{
		name: 'salamence',
		url: 'https://pokeapi.co/api/v2/pokemon/373/',
		id: 373
	},
	{
		name: 'beldum',
		url: 'https://pokeapi.co/api/v2/pokemon/374/',
		id: 374
	},
	{
		name: 'metang',
		url: 'https://pokeapi.co/api/v2/pokemon/375/',
		id: 375
	},
	{
		name: 'metagross',
		url: 'https://pokeapi.co/api/v2/pokemon/376/',
		id: 376
	},
	{
		name: 'regirock',
		url: 'https://pokeapi.co/api/v2/pokemon/377/',
		id: 377
	},
	{
		name: 'regice',
		url: 'https://pokeapi.co/api/v2/pokemon/378/',
		id: 378
	},
	{
		name: 'registeel',
		url: 'https://pokeapi.co/api/v2/pokemon/379/',
		id: 379
	},
	{
		name: 'latias',
		url: 'https://pokeapi.co/api/v2/pokemon/380/',
		id: 380
	},
	{
		name: 'latios',
		url: 'https://pokeapi.co/api/v2/pokemon/381/',
		id: 381
	},
	{
		name: 'kyogre',
		url: 'https://pokeapi.co/api/v2/pokemon/382/',
		id: 382
	},
	{
		name: 'groudon',
		url: 'https://pokeapi.co/api/v2/pokemon/383/',
		id: 383
	},
	{
		name: 'rayquaza',
		url: 'https://pokeapi.co/api/v2/pokemon/384/',
		id: 384
	},
	{
		name: 'jirachi',
		url: 'https://pokeapi.co/api/v2/pokemon/385/',
		id: 385
	},
	{
		name: 'deoxys-normal',
		url: 'https://pokeapi.co/api/v2/pokemon/386/',
		id: 386
	},
	{
		name: 'turtwig',
		url: 'https://pokeapi.co/api/v2/pokemon/387/',
		id: 387
	},
	{
		name: 'grotle',
		url: 'https://pokeapi.co/api/v2/pokemon/388/',
		id: 388
	},
	{
		name: 'torterra',
		url: 'https://pokeapi.co/api/v2/pokemon/389/',
		id: 389
	},
	{
		name: 'chimchar',
		url: 'https://pokeapi.co/api/v2/pokemon/390/',
		id: 390
	},
	{
		name: 'monferno',
		url: 'https://pokeapi.co/api/v2/pokemon/391/',
		id: 391
	},
	{
		name: 'infernape',
		url: 'https://pokeapi.co/api/v2/pokemon/392/',
		id: 392
	},
	{
		name: 'piplup',
		url: 'https://pokeapi.co/api/v2/pokemon/393/',
		id: 393
	},
	{
		name: 'prinplup',
		url: 'https://pokeapi.co/api/v2/pokemon/394/',
		id: 394
	},
	{
		name: 'empoleon',
		url: 'https://pokeapi.co/api/v2/pokemon/395/',
		id: 395
	},
	{
		name: 'starly',
		url: 'https://pokeapi.co/api/v2/pokemon/396/',
		id: 396
	},
	{
		name: 'staravia',
		url: 'https://pokeapi.co/api/v2/pokemon/397/',
		id: 397
	},
	{
		name: 'staraptor',
		url: 'https://pokeapi.co/api/v2/pokemon/398/',
		id: 398
	},
	{
		name: 'bidoof',
		url: 'https://pokeapi.co/api/v2/pokemon/399/',
		id: 399
	},
	{
		name: 'bibarel',
		url: 'https://pokeapi.co/api/v2/pokemon/400/',
		id: 400
	},
	{
		name: 'kricketot',
		url: 'https://pokeapi.co/api/v2/pokemon/401/',
		id: 401
	},
	{
		name: 'kricketune',
		url: 'https://pokeapi.co/api/v2/pokemon/402/',
		id: 402
	},
	{
		name: 'shinx',
		url: 'https://pokeapi.co/api/v2/pokemon/403/',
		id: 403
	},
	{
		name: 'luxio',
		url: 'https://pokeapi.co/api/v2/pokemon/404/',
		id: 404
	},
	{
		name: 'luxray',
		url: 'https://pokeapi.co/api/v2/pokemon/405/',
		id: 405
	},
	{
		name: 'budew',
		url: 'https://pokeapi.co/api/v2/pokemon/406/',
		id: 406
	},
	{
		name: 'roserade',
		url: 'https://pokeapi.co/api/v2/pokemon/407/',
		id: 407
	},
	{
		name: 'cranidos',
		url: 'https://pokeapi.co/api/v2/pokemon/408/',
		id: 408
	},
	{
		name: 'rampardos',
		url: 'https://pokeapi.co/api/v2/pokemon/409/',
		id: 409
	},
	{
		name: 'shieldon',
		url: 'https://pokeapi.co/api/v2/pokemon/410/',
		id: 410
	},
	{
		name: 'bastiodon',
		url: 'https://pokeapi.co/api/v2/pokemon/411/',
		id: 411
	},
	{
		name: 'burmy',
		url: 'https://pokeapi.co/api/v2/pokemon/412/',
		id: 412
	},
	{
		name: 'wormadam-plant',
		url: 'https://pokeapi.co/api/v2/pokemon/413/',
		id: 413
	},
	{
		name: 'mothim',
		url: 'https://pokeapi.co/api/v2/pokemon/414/',
		id: 414
	},
	{
		name: 'combee',
		url: 'https://pokeapi.co/api/v2/pokemon/415/',
		id: 415
	},
	{
		name: 'vespiquen',
		url: 'https://pokeapi.co/api/v2/pokemon/416/',
		id: 416
	},
	{
		name: 'pachirisu',
		url: 'https://pokeapi.co/api/v2/pokemon/417/',
		id: 417
	},
	{
		name: 'buizel',
		url: 'https://pokeapi.co/api/v2/pokemon/418/',
		id: 418
	},
	{
		name: 'floatzel',
		url: 'https://pokeapi.co/api/v2/pokemon/419/',
		id: 419
	},
	{
		name: 'cherubi',
		url: 'https://pokeapi.co/api/v2/pokemon/420/',
		id: 420
	},
	{
		name: 'cherrim',
		url: 'https://pokeapi.co/api/v2/pokemon/421/',
		id: 421
	},
	{
		name: 'shellos',
		url: 'https://pokeapi.co/api/v2/pokemon/422/',
		id: 422
	},
	{
		name: 'gastrodon',
		url: 'https://pokeapi.co/api/v2/pokemon/423/',
		id: 423
	},
	{
		name: 'ambipom',
		url: 'https://pokeapi.co/api/v2/pokemon/424/',
		id: 424
	},
	{
		name: 'drifloon',
		url: 'https://pokeapi.co/api/v2/pokemon/425/',
		id: 425
	},
	{
		name: 'drifblim',
		url: 'https://pokeapi.co/api/v2/pokemon/426/',
		id: 426
	},
	{
		name: 'buneary',
		url: 'https://pokeapi.co/api/v2/pokemon/427/',
		id: 427
	},
	{
		name: 'lopunny',
		url: 'https://pokeapi.co/api/v2/pokemon/428/',
		id: 428
	},
	{
		name: 'mismagius',
		url: 'https://pokeapi.co/api/v2/pokemon/429/',
		id: 429
	},
	{
		name: 'honchkrow',
		url: 'https://pokeapi.co/api/v2/pokemon/430/',
		id: 430
	},
	{
		name: 'glameow',
		url: 'https://pokeapi.co/api/v2/pokemon/431/',
		id: 431
	},
	{
		name: 'purugly',
		url: 'https://pokeapi.co/api/v2/pokemon/432/',
		id: 432
	},
	{
		name: 'chingling',
		url: 'https://pokeapi.co/api/v2/pokemon/433/',
		id: 433
	},
	{
		name: 'stunky',
		url: 'https://pokeapi.co/api/v2/pokemon/434/',
		id: 434
	},
	{
		name: 'skuntank',
		url: 'https://pokeapi.co/api/v2/pokemon/435/',
		id: 435
	},
	{
		name: 'bronzor',
		url: 'https://pokeapi.co/api/v2/pokemon/436/',
		id: 436
	},
	{
		name: 'bronzong',
		url: 'https://pokeapi.co/api/v2/pokemon/437/',
		id: 437
	},
	{
		name: 'bonsly',
		url: 'https://pokeapi.co/api/v2/pokemon/438/',
		id: 438
	},
	{
		name: 'mime-jr',
		url: 'https://pokeapi.co/api/v2/pokemon/439/',
		id: 439
	},
	{
		name: 'happiny',
		url: 'https://pokeapi.co/api/v2/pokemon/440/',
		id: 440
	},
	{
		name: 'chatot',
		url: 'https://pokeapi.co/api/v2/pokemon/441/',
		id: 441
	},
	{
		name: 'spiritomb',
		url: 'https://pokeapi.co/api/v2/pokemon/442/',
		id: 442
	},
	{
		name: 'gible',
		url: 'https://pokeapi.co/api/v2/pokemon/443/',
		id: 443
	},
	{
		name: 'gabite',
		url: 'https://pokeapi.co/api/v2/pokemon/444/',
		id: 444
	},
	{
		name: 'garchomp',
		url: 'https://pokeapi.co/api/v2/pokemon/445/',
		id: 445
	},
	{
		name: 'munchlax',
		url: 'https://pokeapi.co/api/v2/pokemon/446/',
		id: 446
	},
	{
		name: 'riolu',
		url: 'https://pokeapi.co/api/v2/pokemon/447/',
		id: 447
	},
	{
		name: 'lucario',
		url: 'https://pokeapi.co/api/v2/pokemon/448/',
		id: 448
	},
	{
		name: 'hippopotas',
		url: 'https://pokeapi.co/api/v2/pokemon/449/',
		id: 449
	},
	{
		name: 'hippowdon',
		url: 'https://pokeapi.co/api/v2/pokemon/450/',
		id: 450
	},
	{
		name: 'skorupi',
		url: 'https://pokeapi.co/api/v2/pokemon/451/',
		id: 451
	},
	{
		name: 'drapion',
		url: 'https://pokeapi.co/api/v2/pokemon/452/',
		id: 452
	},
	{
		name: 'croagunk',
		url: 'https://pokeapi.co/api/v2/pokemon/453/',
		id: 453
	},
	{
		name: 'toxicroak',
		url: 'https://pokeapi.co/api/v2/pokemon/454/',
		id: 454
	},
	{
		name: 'carnivine',
		url: 'https://pokeapi.co/api/v2/pokemon/455/',
		id: 455
	},
	{
		name: 'finneon',
		url: 'https://pokeapi.co/api/v2/pokemon/456/',
		id: 456
	},
	{
		name: 'lumineon',
		url: 'https://pokeapi.co/api/v2/pokemon/457/',
		id: 457
	},
	{
		name: 'mantyke',
		url: 'https://pokeapi.co/api/v2/pokemon/458/',
		id: 458
	},
	{
		name: 'snover',
		url: 'https://pokeapi.co/api/v2/pokemon/459/',
		id: 459
	},
	{
		name: 'abomasnow',
		url: 'https://pokeapi.co/api/v2/pokemon/460/',
		id: 460
	},
	{
		name: 'weavile',
		url: 'https://pokeapi.co/api/v2/pokemon/461/',
		id: 461
	},
	{
		name: 'magnezone',
		url: 'https://pokeapi.co/api/v2/pokemon/462/',
		id: 462
	},
	{
		name: 'lickilicky',
		url: 'https://pokeapi.co/api/v2/pokemon/463/',
		id: 463
	},
	{
		name: 'rhyperior',
		url: 'https://pokeapi.co/api/v2/pokemon/464/',
		id: 464
	},
	{
		name: 'tangrowth',
		url: 'https://pokeapi.co/api/v2/pokemon/465/',
		id: 465
	},
	{
		name: 'electivire',
		url: 'https://pokeapi.co/api/v2/pokemon/466/',
		id: 466
	},
	{
		name: 'magmortar',
		url: 'https://pokeapi.co/api/v2/pokemon/467/',
		id: 467
	},
	{
		name: 'togekiss',
		url: 'https://pokeapi.co/api/v2/pokemon/468/',
		id: 468
	},
	{
		name: 'yanmega',
		url: 'https://pokeapi.co/api/v2/pokemon/469/',
		id: 469
	},
	{
		name: 'leafeon',
		url: 'https://pokeapi.co/api/v2/pokemon/470/',
		id: 470
	},
	{
		name: 'glaceon',
		url: 'https://pokeapi.co/api/v2/pokemon/471/',
		id: 471
	},
	{
		name: 'gliscor',
		url: 'https://pokeapi.co/api/v2/pokemon/472/',
		id: 472
	},
	{
		name: 'mamoswine',
		url: 'https://pokeapi.co/api/v2/pokemon/473/',
		id: 473
	},
	{
		name: 'porygon-z',
		url: 'https://pokeapi.co/api/v2/pokemon/474/',
		id: 474
	},
	{
		name: 'gallade',
		url: 'https://pokeapi.co/api/v2/pokemon/475/',
		id: 475
	},
	{
		name: 'probopass',
		url: 'https://pokeapi.co/api/v2/pokemon/476/',
		id: 476
	},
	{
		name: 'dusknoir',
		url: 'https://pokeapi.co/api/v2/pokemon/477/',
		id: 477
	},
	{
		name: 'froslass',
		url: 'https://pokeapi.co/api/v2/pokemon/478/',
		id: 478
	},
	{
		name: 'rotom',
		url: 'https://pokeapi.co/api/v2/pokemon/479/',
		id: 479
	},
	{
		name: 'uxie',
		url: 'https://pokeapi.co/api/v2/pokemon/480/',
		id: 480
	},
	{
		name: 'mesprit',
		url: 'https://pokeapi.co/api/v2/pokemon/481/',
		id: 481
	},
	{
		name: 'azelf',
		url: 'https://pokeapi.co/api/v2/pokemon/482/',
		id: 482
	},
	{
		name: 'dialga',
		url: 'https://pokeapi.co/api/v2/pokemon/483/',
		id: 483
	},
	{
		name: 'palkia',
		url: 'https://pokeapi.co/api/v2/pokemon/484/',
		id: 484
	},
	{
		name: 'heatran',
		url: 'https://pokeapi.co/api/v2/pokemon/485/',
		id: 485
	},
	{
		name: 'regigigas',
		url: 'https://pokeapi.co/api/v2/pokemon/486/',
		id: 486
	},
	{
		name: 'giratina-altered',
		url: 'https://pokeapi.co/api/v2/pokemon/487/',
		id: 487
	},
	{
		name: 'cresselia',
		url: 'https://pokeapi.co/api/v2/pokemon/488/',
		id: 488
	},
	{
		name: 'phione',
		url: 'https://pokeapi.co/api/v2/pokemon/489/',
		id: 489
	},
	{
		name: 'manaphy',
		url: 'https://pokeapi.co/api/v2/pokemon/490/',
		id: 490
	},
	{
		name: 'darkrai',
		url: 'https://pokeapi.co/api/v2/pokemon/491/',
		id: 491
	},
	{
		name: 'shaymin-land',
		url: 'https://pokeapi.co/api/v2/pokemon/492/',
		id: 492
	},
	{
		name: 'arceus',
		url: 'https://pokeapi.co/api/v2/pokemon/493/',
		id: 493
	},
	{
		name: 'victini',
		url: 'https://pokeapi.co/api/v2/pokemon/494/',
		id: 494
	},
	{
		name: 'snivy',
		url: 'https://pokeapi.co/api/v2/pokemon/495/',
		id: 495
	},
	{
		name: 'servine',
		url: 'https://pokeapi.co/api/v2/pokemon/496/',
		id: 496
	},
	{
		name: 'serperior',
		url: 'https://pokeapi.co/api/v2/pokemon/497/',
		id: 497
	},
	{
		name: 'tepig',
		url: 'https://pokeapi.co/api/v2/pokemon/498/',
		id: 498
	},
	{
		name: 'pignite',
		url: 'https://pokeapi.co/api/v2/pokemon/499/',
		id: 499
	},
	{
		name: 'emboar',
		url: 'https://pokeapi.co/api/v2/pokemon/500/',
		id: 500
	},
	{
		name: 'oshawott',
		url: 'https://pokeapi.co/api/v2/pokemon/501/',
		id: 501
	},
	{
		name: 'dewott',
		url: 'https://pokeapi.co/api/v2/pokemon/502/',
		id: 502
	},
	{
		name: 'samurott',
		url: 'https://pokeapi.co/api/v2/pokemon/503/',
		id: 503
	},
	{
		name: 'patrat',
		url: 'https://pokeapi.co/api/v2/pokemon/504/',
		id: 504
	},
	{
		name: 'watchog',
		url: 'https://pokeapi.co/api/v2/pokemon/505/',
		id: 505
	},
	{
		name: 'lillipup',
		url: 'https://pokeapi.co/api/v2/pokemon/506/',
		id: 506
	},
	{
		name: 'herdier',
		url: 'https://pokeapi.co/api/v2/pokemon/507/',
		id: 507
	},
	{
		name: 'stoutland',
		url: 'https://pokeapi.co/api/v2/pokemon/508/',
		id: 508
	},
	{
		name: 'purrloin',
		url: 'https://pokeapi.co/api/v2/pokemon/509/',
		id: 509
	},
	{
		name: 'liepard',
		url: 'https://pokeapi.co/api/v2/pokemon/510/',
		id: 510
	},
	{
		name: 'pansage',
		url: 'https://pokeapi.co/api/v2/pokemon/511/',
		id: 511
	},
	{
		name: 'simisage',
		url: 'https://pokeapi.co/api/v2/pokemon/512/',
		id: 512
	},
	{
		name: 'pansear',
		url: 'https://pokeapi.co/api/v2/pokemon/513/',
		id: 513
	},
	{
		name: 'simisear',
		url: 'https://pokeapi.co/api/v2/pokemon/514/',
		id: 514
	},
	{
		name: 'panpour',
		url: 'https://pokeapi.co/api/v2/pokemon/515/',
		id: 515
	},
	{
		name: 'simipour',
		url: 'https://pokeapi.co/api/v2/pokemon/516/',
		id: 516
	},
	{
		name: 'munna',
		url: 'https://pokeapi.co/api/v2/pokemon/517/',
		id: 517
	},
	{
		name: 'musharna',
		url: 'https://pokeapi.co/api/v2/pokemon/518/',
		id: 518
	},
	{
		name: 'pidove',
		url: 'https://pokeapi.co/api/v2/pokemon/519/',
		id: 519
	},
	{
		name: 'tranquill',
		url: 'https://pokeapi.co/api/v2/pokemon/520/',
		id: 520
	},
	{
		name: 'unfezant',
		url: 'https://pokeapi.co/api/v2/pokemon/521/',
		id: 521
	},
	{
		name: 'blitzle',
		url: 'https://pokeapi.co/api/v2/pokemon/522/',
		id: 522
	},
	{
		name: 'zebstrika',
		url: 'https://pokeapi.co/api/v2/pokemon/523/',
		id: 523
	},
	{
		name: 'roggenrola',
		url: 'https://pokeapi.co/api/v2/pokemon/524/',
		id: 524
	},
	{
		name: 'boldore',
		url: 'https://pokeapi.co/api/v2/pokemon/525/',
		id: 525
	},
	{
		name: 'gigalith',
		url: 'https://pokeapi.co/api/v2/pokemon/526/',
		id: 526
	},
	{
		name: 'woobat',
		url: 'https://pokeapi.co/api/v2/pokemon/527/',
		id: 527
	},
	{
		name: 'swoobat',
		url: 'https://pokeapi.co/api/v2/pokemon/528/',
		id: 528
	},
	{
		name: 'drilbur',
		url: 'https://pokeapi.co/api/v2/pokemon/529/',
		id: 529
	},
	{
		name: 'excadrill',
		url: 'https://pokeapi.co/api/v2/pokemon/530/',
		id: 530
	},
	{
		name: 'audino',
		url: 'https://pokeapi.co/api/v2/pokemon/531/',
		id: 531
	},
	{
		name: 'timburr',
		url: 'https://pokeapi.co/api/v2/pokemon/532/',
		id: 532
	},
	{
		name: 'gurdurr',
		url: 'https://pokeapi.co/api/v2/pokemon/533/',
		id: 533
	},
	{
		name: 'conkeldurr',
		url: 'https://pokeapi.co/api/v2/pokemon/534/',
		id: 534
	},
	{
		name: 'tympole',
		url: 'https://pokeapi.co/api/v2/pokemon/535/',
		id: 535
	},
	{
		name: 'palpitoad',
		url: 'https://pokeapi.co/api/v2/pokemon/536/',
		id: 536
	},
	{
		name: 'seismitoad',
		url: 'https://pokeapi.co/api/v2/pokemon/537/',
		id: 537
	},
	{
		name: 'throh',
		url: 'https://pokeapi.co/api/v2/pokemon/538/',
		id: 538
	},
	{
		name: 'sawk',
		url: 'https://pokeapi.co/api/v2/pokemon/539/',
		id: 539
	},
	{
		name: 'sewaddle',
		url: 'https://pokeapi.co/api/v2/pokemon/540/',
		id: 540
	},
	{
		name: 'swadloon',
		url: 'https://pokeapi.co/api/v2/pokemon/541/',
		id: 541
	},
	{
		name: 'leavanny',
		url: 'https://pokeapi.co/api/v2/pokemon/542/',
		id: 542
	},
	{
		name: 'venipede',
		url: 'https://pokeapi.co/api/v2/pokemon/543/',
		id: 543
	},
	{
		name: 'whirlipede',
		url: 'https://pokeapi.co/api/v2/pokemon/544/',
		id: 544
	},
	{
		name: 'scolipede',
		url: 'https://pokeapi.co/api/v2/pokemon/545/',
		id: 545
	},
	{
		name: 'cottonee',
		url: 'https://pokeapi.co/api/v2/pokemon/546/',
		id: 546
	},
	{
		name: 'whimsicott',
		url: 'https://pokeapi.co/api/v2/pokemon/547/',
		id: 547
	},
	{
		name: 'petilil',
		url: 'https://pokeapi.co/api/v2/pokemon/548/',
		id: 548
	},
	{
		name: 'lilligant',
		url: 'https://pokeapi.co/api/v2/pokemon/549/',
		id: 549
	},
	{
		name: 'basculin-red-striped',
		url: 'https://pokeapi.co/api/v2/pokemon/550/',
		id: 550
	},
	{
		name: 'sandile',
		url: 'https://pokeapi.co/api/v2/pokemon/551/',
		id: 551
	},
	{
		name: 'krokorok',
		url: 'https://pokeapi.co/api/v2/pokemon/552/',
		id: 552
	},
	{
		name: 'krookodile',
		url: 'https://pokeapi.co/api/v2/pokemon/553/',
		id: 553
	},
	{
		name: 'darumaka',
		url: 'https://pokeapi.co/api/v2/pokemon/554/',
		id: 554
	},
	{
		name: 'darmanitan-standard',
		url: 'https://pokeapi.co/api/v2/pokemon/555/',
		id: 555
	},
	{
		name: 'maractus',
		url: 'https://pokeapi.co/api/v2/pokemon/556/',
		id: 556
	},
	{
		name: 'dwebble',
		url: 'https://pokeapi.co/api/v2/pokemon/557/',
		id: 557
	},
	{
		name: 'crustle',
		url: 'https://pokeapi.co/api/v2/pokemon/558/',
		id: 558
	},
	{
		name: 'scraggy',
		url: 'https://pokeapi.co/api/v2/pokemon/559/',
		id: 559
	},
	{
		name: 'scrafty',
		url: 'https://pokeapi.co/api/v2/pokemon/560/',
		id: 560
	},
	{
		name: 'sigilyph',
		url: 'https://pokeapi.co/api/v2/pokemon/561/',
		id: 561
	},
	{
		name: 'yamask',
		url: 'https://pokeapi.co/api/v2/pokemon/562/',
		id: 562
	},
	{
		name: 'cofagrigus',
		url: 'https://pokeapi.co/api/v2/pokemon/563/',
		id: 563
	},
	{
		name: 'tirtouga',
		url: 'https://pokeapi.co/api/v2/pokemon/564/',
		id: 564
	},
	{
		name: 'carracosta',
		url: 'https://pokeapi.co/api/v2/pokemon/565/',
		id: 565
	},
	{
		name: 'archen',
		url: 'https://pokeapi.co/api/v2/pokemon/566/',
		id: 566
	},
	{
		name: 'archeops',
		url: 'https://pokeapi.co/api/v2/pokemon/567/',
		id: 567
	},
	{
		name: 'trubbish',
		url: 'https://pokeapi.co/api/v2/pokemon/568/',
		id: 568
	},
	{
		name: 'garbodor',
		url: 'https://pokeapi.co/api/v2/pokemon/569/',
		id: 569
	},
	{
		name: 'zorua',
		url: 'https://pokeapi.co/api/v2/pokemon/570/',
		id: 570
	},
	{
		name: 'zoroark',
		url: 'https://pokeapi.co/api/v2/pokemon/571/',
		id: 571
	},
	{
		name: 'minccino',
		url: 'https://pokeapi.co/api/v2/pokemon/572/',
		id: 572
	},
	{
		name: 'cinccino',
		url: 'https://pokeapi.co/api/v2/pokemon/573/',
		id: 573
	},
	{
		name: 'gothita',
		url: 'https://pokeapi.co/api/v2/pokemon/574/',
		id: 574
	},
	{
		name: 'gothorita',
		url: 'https://pokeapi.co/api/v2/pokemon/575/',
		id: 575
	},
	{
		name: 'gothitelle',
		url: 'https://pokeapi.co/api/v2/pokemon/576/',
		id: 576
	},
	{
		name: 'solosis',
		url: 'https://pokeapi.co/api/v2/pokemon/577/',
		id: 577
	},
	{
		name: 'duosion',
		url: 'https://pokeapi.co/api/v2/pokemon/578/',
		id: 578
	},
	{
		name: 'reuniclus',
		url: 'https://pokeapi.co/api/v2/pokemon/579/',
		id: 579
	},
	{
		name: 'ducklett',
		url: 'https://pokeapi.co/api/v2/pokemon/580/',
		id: 580
	},
	{
		name: 'swanna',
		url: 'https://pokeapi.co/api/v2/pokemon/581/',
		id: 581
	},
	{
		name: 'vanillite',
		url: 'https://pokeapi.co/api/v2/pokemon/582/',
		id: 582
	},
	{
		name: 'vanillish',
		url: 'https://pokeapi.co/api/v2/pokemon/583/',
		id: 583
	},
	{
		name: 'vanilluxe',
		url: 'https://pokeapi.co/api/v2/pokemon/584/',
		id: 584
	},
	{
		name: 'deerling',
		url: 'https://pokeapi.co/api/v2/pokemon/585/',
		id: 585
	},
	{
		name: 'sawsbuck',
		url: 'https://pokeapi.co/api/v2/pokemon/586/',
		id: 586
	},
	{
		name: 'emolga',
		url: 'https://pokeapi.co/api/v2/pokemon/587/',
		id: 587
	},
	{
		name: 'karrablast',
		url: 'https://pokeapi.co/api/v2/pokemon/588/',
		id: 588
	},
	{
		name: 'escavalier',
		url: 'https://pokeapi.co/api/v2/pokemon/589/',
		id: 589
	},
	{
		name: 'foongus',
		url: 'https://pokeapi.co/api/v2/pokemon/590/',
		id: 590
	},
	{
		name: 'amoonguss',
		url: 'https://pokeapi.co/api/v2/pokemon/591/',
		id: 591
	},
	{
		name: 'frillish',
		url: 'https://pokeapi.co/api/v2/pokemon/592/',
		id: 592
	},
	{
		name: 'jellicent',
		url: 'https://pokeapi.co/api/v2/pokemon/593/',
		id: 593
	},
	{
		name: 'alomomola',
		url: 'https://pokeapi.co/api/v2/pokemon/594/',
		id: 594
	},
	{
		name: 'joltik',
		url: 'https://pokeapi.co/api/v2/pokemon/595/',
		id: 595
	},
	{
		name: 'galvantula',
		url: 'https://pokeapi.co/api/v2/pokemon/596/',
		id: 596
	},
	{
		name: 'ferroseed',
		url: 'https://pokeapi.co/api/v2/pokemon/597/',
		id: 597
	},
	{
		name: 'ferrothorn',
		url: 'https://pokeapi.co/api/v2/pokemon/598/',
		id: 598
	},
	{
		name: 'klink',
		url: 'https://pokeapi.co/api/v2/pokemon/599/',
		id: 599
	},
	{
		name: 'klang',
		url: 'https://pokeapi.co/api/v2/pokemon/600/',
		id: 600
	},
	{
		name: 'klinklang',
		url: 'https://pokeapi.co/api/v2/pokemon/601/',
		id: 601
	},
	{
		name: 'tynamo',
		url: 'https://pokeapi.co/api/v2/pokemon/602/',
		id: 602
	},
	{
		name: 'eelektrik',
		url: 'https://pokeapi.co/api/v2/pokemon/603/',
		id: 603
	},
	{
		name: 'eelektross',
		url: 'https://pokeapi.co/api/v2/pokemon/604/',
		id: 604
	},
	{
		name: 'elgyem',
		url: 'https://pokeapi.co/api/v2/pokemon/605/',
		id: 605
	},
	{
		name: 'beheeyem',
		url: 'https://pokeapi.co/api/v2/pokemon/606/',
		id: 606
	},
	{
		name: 'litwick',
		url: 'https://pokeapi.co/api/v2/pokemon/607/',
		id: 607
	},
	{
		name: 'lampent',
		url: 'https://pokeapi.co/api/v2/pokemon/608/',
		id: 608
	},
	{
		name: 'chandelure',
		url: 'https://pokeapi.co/api/v2/pokemon/609/',
		id: 609
	},
	{
		name: 'axew',
		url: 'https://pokeapi.co/api/v2/pokemon/610/',
		id: 610
	},
	{
		name: 'fraxure',
		url: 'https://pokeapi.co/api/v2/pokemon/611/',
		id: 611
	},
	{
		name: 'haxorus',
		url: 'https://pokeapi.co/api/v2/pokemon/612/',
		id: 612
	},
	{
		name: 'cubchoo',
		url: 'https://pokeapi.co/api/v2/pokemon/613/',
		id: 613
	},
	{
		name: 'beartic',
		url: 'https://pokeapi.co/api/v2/pokemon/614/',
		id: 614
	},
	{
		name: 'cryogonal',
		url: 'https://pokeapi.co/api/v2/pokemon/615/',
		id: 615
	},
	{
		name: 'shelmet',
		url: 'https://pokeapi.co/api/v2/pokemon/616/',
		id: 616
	},
	{
		name: 'accelgor',
		url: 'https://pokeapi.co/api/v2/pokemon/617/',
		id: 617
	},
	{
		name: 'stunfisk',
		url: 'https://pokeapi.co/api/v2/pokemon/618/',
		id: 618
	},
	{
		name: 'mienfoo',
		url: 'https://pokeapi.co/api/v2/pokemon/619/',
		id: 619
	},
	{
		name: 'mienshao',
		url: 'https://pokeapi.co/api/v2/pokemon/620/',
		id: 620
	},
	{
		name: 'druddigon',
		url: 'https://pokeapi.co/api/v2/pokemon/621/',
		id: 621
	},
	{
		name: 'golett',
		url: 'https://pokeapi.co/api/v2/pokemon/622/',
		id: 622
	},
	{
		name: 'golurk',
		url: 'https://pokeapi.co/api/v2/pokemon/623/',
		id: 623
	},
	{
		name: 'pawniard',
		url: 'https://pokeapi.co/api/v2/pokemon/624/',
		id: 624
	},
	{
		name: 'bisharp',
		url: 'https://pokeapi.co/api/v2/pokemon/625/',
		id: 625
	},
	{
		name: 'bouffalant',
		url: 'https://pokeapi.co/api/v2/pokemon/626/',
		id: 626
	},
	{
		name: 'rufflet',
		url: 'https://pokeapi.co/api/v2/pokemon/627/',
		id: 627
	},
	{
		name: 'braviary',
		url: 'https://pokeapi.co/api/v2/pokemon/628/',
		id: 628
	},
	{
		name: 'vullaby',
		url: 'https://pokeapi.co/api/v2/pokemon/629/',
		id: 629
	},
	{
		name: 'mandibuzz',
		url: 'https://pokeapi.co/api/v2/pokemon/630/',
		id: 630
	},
	{
		name: 'heatmor',
		url: 'https://pokeapi.co/api/v2/pokemon/631/',
		id: 631
	},
	{
		name: 'durant',
		url: 'https://pokeapi.co/api/v2/pokemon/632/',
		id: 632
	},
	{
		name: 'deino',
		url: 'https://pokeapi.co/api/v2/pokemon/633/',
		id: 633
	},
	{
		name: 'zweilous',
		url: 'https://pokeapi.co/api/v2/pokemon/634/',
		id: 634
	},
	{
		name: 'hydreigon',
		url: 'https://pokeapi.co/api/v2/pokemon/635/',
		id: 635
	},
	{
		name: 'larvesta',
		url: 'https://pokeapi.co/api/v2/pokemon/636/',
		id: 636
	},
	{
		name: 'volcarona',
		url: 'https://pokeapi.co/api/v2/pokemon/637/',
		id: 637
	},
	{
		name: 'cobalion',
		url: 'https://pokeapi.co/api/v2/pokemon/638/',
		id: 638
	},
	{
		name: 'terrakion',
		url: 'https://pokeapi.co/api/v2/pokemon/639/',
		id: 639
	},
	{
		name: 'virizion',
		url: 'https://pokeapi.co/api/v2/pokemon/640/',
		id: 640
	},
	{
		name: 'tornadus-incarnate',
		url: 'https://pokeapi.co/api/v2/pokemon/641/',
		id: 641
	},
	{
		name: 'thundurus-incarnate',
		url: 'https://pokeapi.co/api/v2/pokemon/642/',
		id: 642
	},
	{
		name: 'reshiram',
		url: 'https://pokeapi.co/api/v2/pokemon/643/',
		id: 643
	},
	{
		name: 'zekrom',
		url: 'https://pokeapi.co/api/v2/pokemon/644/',
		id: 644
	},
	{
		name: 'landorus-incarnate',
		url: 'https://pokeapi.co/api/v2/pokemon/645/',
		id: 645
	},
	{
		name: 'kyurem',
		url: 'https://pokeapi.co/api/v2/pokemon/646/',
		id: 646
	},
	{
		name: 'keldeo-ordinary',
		url: 'https://pokeapi.co/api/v2/pokemon/647/',
		id: 647
	},
	{
		name: 'meloetta-aria',
		url: 'https://pokeapi.co/api/v2/pokemon/648/',
		id: 648
	},
	{
		name: 'genesect',
		url: 'https://pokeapi.co/api/v2/pokemon/649/',
		id: 649
	}
];
