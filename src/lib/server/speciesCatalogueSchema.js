export const SPECIES_REQUIRED_FIELDS = Object.freeze([
	['pokedexNumber', 'number'],
	['name', 'text'],
	['generation', 'number'],
	['types', 'json'],
	['stats', 'json'],
	['provenance', 'json'],
	['assetState', 'json']
]);

/**
 * @param {{ name: string; fields: Array<{ name: string; type: string; required?: boolean }>; indexes: string[] }} collection
 */
export function verifySpeciesCollectionSchema(collection) {
	const errors = [];
	if (collection.name !== 'pokemon')
		errors.push(`Expected pokemon collection, found ${collection.name}`);
	for (const [name, type] of SPECIES_REQUIRED_FIELDS) {
		const field = collection.fields.find((candidate) => candidate.name === name);
		if (!field) errors.push(`Missing required pokemon schema field: ${name}`);
		else if (field.type !== type || !field.required)
			errors.push(`Pokemon schema field ${name} must be a required ${type}`);
	}
	const hasUniquePokedexIndex = collection.indexes.some((index) =>
		/create\s+unique\s+index[\s\S]*\(\s*"?pokedexNumber"?\s*\)/i.test(index)
	);
	if (!hasUniquePokedexIndex)
		errors.push('Pokemon schema requires a unique index on pokedexNumber');
	if (errors.length) throw new Error(errors.join('; '));
}
