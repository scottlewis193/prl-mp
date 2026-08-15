import type PocketBase from 'pocketbase';
import { FALLBACK_WALK_ANIMATION } from '../species';
import {
	listSpecies,
	resolveSpecies,
	type SpeciesCatalogueEntry,
	type SpeciesCatalogueRepository,
	type StoredSpecies
} from './speciesCatalogue';

type PokemonRecord = Record<string, unknown> & { id: string };

function recordData(species: SpeciesCatalogueEntry) {
	return {
		pokedexNumber: species.pokedexNumber,
		name: species.name,
		generation: species.generation,
		types: species.types,
		stats: species.baseStats,
		provenance: species.provenance,
		assetState: species.assets,
		hp: species.baseStats.hp,
		attack: species.baseStats.attack,
		defense: species.baseStats.defense,
		speed: species.baseStats.speed,
		...(species.assets.walkAnimation === 'fallback' ? { animData: FALLBACK_WALK_ANIMATION } : {})
	};
}

function storedSpecies(record: PokemonRecord): StoredSpecies {
	return {
		id: record.id,
		pokedexNumber: Number(record.pokedexNumber),
		name: String(record.name),
		generation: Number(record.generation),
		types: record.types as string[],
		baseStats: record.stats as SpeciesCatalogueEntry['baseStats'],
		provenance: record.provenance as SpeciesCatalogueEntry['provenance'],
		assets: record.assetState as SpeciesCatalogueEntry['assets']
	};
}

export class PocketBaseSpeciesCatalogueRepository implements SpeciesCatalogueRepository {
	constructor(private readonly pb: PocketBase) {}

	async list(): Promise<StoredSpecies[]> {
		const records = await this.pb.collection('pokemon').getFullList({
			batch: 1_000,
			fields: 'id,pokedexNumber,name,generation,types,stats,provenance,assetState'
		});
		return records.map((record) => storedSpecies(record as PokemonRecord));
	}

	async create(species: SpeciesCatalogueEntry): Promise<void> {
		await this.pb.collection('pokemon').create({
			id: `prlpk${String(species.pokedexNumber).padStart(10, '0')}`,
			...recordData(species),
			animData: species.assets.walkAnimation === 'fallback' ? FALLBACK_WALK_ANIMATION : {},
			moves: []
		});
	}

	async update(id: string, species: SpeciesCatalogueEntry): Promise<void> {
		await this.pb.collection('pokemon').update(id, recordData(species));
	}
}

export function listPocketBaseSpecies(pb: PocketBase): Promise<StoredSpecies[]> {
	return listSpecies(new PocketBaseSpeciesCatalogueRepository(pb));
}

export function resolvePocketBaseSpecies(
	pb: PocketBase,
	identity: number | string
): Promise<StoredSpecies | undefined> {
	return resolveSpecies(new PocketBaseSpeciesCatalogueRepository(pb), identity);
}
