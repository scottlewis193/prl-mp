import assert from 'node:assert/strict';
import test from 'node:test';

import catalogue from '../data/pokemon-species.gen1-5.v1.json';
import {
	importSpeciesCatalogue,
	listSpecies,
	resolveSpecies,
	validateSpeciesCatalogue,
	type SpeciesCatalogueEntry,
	type SpeciesCatalogueRepository,
	type StoredSpecies
} from '../src/lib/server/speciesCatalogue';

class MemorySpeciesRepository implements SpeciesCatalogueRepository {
	records: StoredSpecies[];
	creates = 0;
	updates = 0;

	constructor(records: StoredSpecies[] = []) {
		this.records = structuredClone(records);
	}

	async list(): Promise<StoredSpecies[]> {
		return structuredClone(this.records);
	}

	async create(species: SpeciesCatalogueEntry): Promise<void> {
		this.creates++;
		this.records.push({ id: `species-${species.pokedexNumber}`, ...structuredClone(species) });
	}

	async update(id: string, species: SpeciesCatalogueEntry): Promise<void> {
		this.updates++;
		const index = this.records.findIndex((record) => record.id === id);
		assert.notEqual(index, -1);
		this.records[index] = { id, ...structuredClone(species) };
	}
}

const species = catalogue.species as SpeciesCatalogueEntry[];

test('versioned catalogue contains exactly National Pokédex 001–649 with canonical examples', () => {
	validateSpeciesCatalogue(species);
	assert.equal(species.length, 649);
	assert.deepEqual(species[0], {
		pokedexNumber: 1,
		name: 'Bulbasaur',
		generation: 1,
		types: ['grass', 'poison'],
		baseStats: {
			hp: 45,
			attack: 49,
			defense: 49,
			specialAttack: 65,
			specialDefense: 65,
			speed: 45,
			total: 318
		},
		provenance: catalogue.provenance,
		assets: { portrait: 'bundled', walkAnimation: 'bundled', fallbackSpecies: null }
	});
	assert.equal(species[121]?.name, 'Mr. Mime');
	assert.deepEqual(species[121]?.types, ['psychic', 'fairy']);
	assert.equal(species[493]?.name, 'Victini');
	assert.equal(species[493]?.generation, 5);
	assert.deepEqual(species[648]?.baseStats, {
		hp: 71,
		attack: 120,
		defense: 95,
		specialAttack: 120,
		specialDefense: 95,
		speed: 99,
		total: 600
	});
	assert.deepEqual(species[648]?.assets, {
		portrait: 'fallback',
		walkAnimation: 'fallback',
		fallbackSpecies: 'pikachu'
	});
});

test('catalogue validation names missing and duplicate National Pokédex entries', () => {
	assert.throws(
		() => validateSpeciesCatalogue([...species.slice(0, 648), species[647]]),
		/Duplicate National Pokédex entries: 648; missing entries: 649/
	);
});

test('import reconciles seeded species and is idempotent by National Pokédex number', async () => {
	const repository = new MemorySpeciesRepository([
		{ id: 'existing-bulbasaur', ...species[0], name: 'stale name' }
	]);

	const first = await importSpeciesCatalogue(species, repository);
	assert.deepEqual(first, { created: 648, updated: 1, total: 649 });
	assert.equal(repository.records.length, 649);
	assert.equal(repository.records[0]?.name, 'Bulbasaur');

	const second = await importSpeciesCatalogue(species, repository);
	assert.deepEqual(second, { created: 0, updated: 649, total: 649 });
	assert.equal(repository.records.length, 649);
	assert.equal(new Set(repository.records.map(({ pokedexNumber }) => pokedexNumber)).size, 649);
});

test('application lists and resolves species whose bespoke assets are unavailable', async () => {
	const repository = new MemorySpeciesRepository(
		species.map((entry) => ({ id: `species-${entry.pokedexNumber}`, ...entry }))
	);

	const listed = await listSpecies(repository);
	assert.equal(listed.length, 649);
	assert.equal(listed[648]?.name, 'Genesect');
	assert.equal((await resolveSpecies(repository, 649))?.assets.walkAnimation, 'fallback');
	assert.equal((await resolveSpecies(repository, 'genesect'))?.pokedexNumber, 649);
	assert.equal(await resolveSpecies(repository, 650), undefined);
});
