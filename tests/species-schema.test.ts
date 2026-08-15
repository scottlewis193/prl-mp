import assert from 'node:assert/strict';
import test from 'node:test';

import {
	SPECIES_REQUIRED_FIELDS,
	verifySpeciesCollectionSchema
} from '../src/lib/server/speciesCatalogueSchema';

const validCollection = {
	name: 'pokemon',
	fields: SPECIES_REQUIRED_FIELDS.map(([name, type]) => ({ name, type, required: true })),
	indexes: ['CREATE UNIQUE INDEX idx_pokemon_pokedex_number ON pokemon (pokedexNumber)']
};

test('PocketBase schema verification accepts the complete species catalogue schema', () => {
	assert.doesNotThrow(() => verifySpeciesCollectionSchema(validCollection));
});

test('PocketBase schema verification clearly reports missing fields and uniqueness', () => {
	assert.throws(
		() =>
			verifySpeciesCollectionSchema({
				...validCollection,
				fields: validCollection.fields.slice(1),
				indexes: []
			}),
		/Missing required pokemon schema field: pokedexNumber.*unique index on pokedexNumber/s
	);
});
