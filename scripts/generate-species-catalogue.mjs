import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';

import assetMetadata from '../data/pokemon-assets.v1.json' with { type: 'json' };

export const POKEAPI_SOURCE_COMMIT = '286d7a071bc50ec4a57e3f3f506a13220ce6f903';
export const POKEAPI_SOURCE_FILES = Object.freeze({
	'pokemon.csv': '16c81c33188b0eac403aa2f759fcbe9e42c611f722d263f5b5a6a5bff9f8ce6b',
	'pokemon_species.csv': '9878f19c0637095cdd9a4134b4aac8fb2b64776d3bdc599aa68f15c3a011b87c',
	'pokemon_species_names.csv': '83ae022da379b06f32e863fb83e0faf3cb2a9a8d74dd24835e8769c2d2e713c8',
	'pokemon_stats.csv': '7797b94f06c0e0e83af00e91631035f97cf1c7bb1f61cc17d8a4c8a54382bbcd',
	'pokemon_types.csv': '9f67b663ea488cb779f1672b06da372c6c05145f58ce15b3b9526ff334913cbd',
	'types.csv': '37f039c8d722f47d51ba1c5c5ecf9b7007235b1a9a1af2827645c777b70307c8',
	'type_names.csv': '685230c51074cf2f723debcf827a4df4c36ab0ec7e929c806ad65a3e40958705'
});

const provenance = {
	source: 'PokeAPI',
	version: POKEAPI_SOURCE_COMMIT,
	url: `https://github.com/PokeAPI/pokeapi/tree/${POKEAPI_SOURCE_COMMIT}/data/v2/csv`
};

/**
 * @param {string} sourceDirectory
 * @param {string} filename
 * @param {string[]} requiredColumns
 * @returns {Promise<Record<string, string>[]>}
 */
async function readCsv(sourceDirectory, filename, requiredColumns) {
	const lines = (await readFile(resolve(sourceDirectory, filename), 'utf8')).trim().split(/\r?\n/);
	const columns = lines[0].split(',');
	for (const required of requiredColumns) {
		if (!columns.includes(required))
			throw new Error(`${filename} is missing required column ${required}`);
	}
	return lines.slice(1).map((line) => {
		const values = line.split(',');
		return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
	});
}

/**
 * @param {string} sourceDirectory
 */
async function verifyPinnedSources(sourceDirectory) {
	for (const [filename, expectedHash] of Object.entries(POKEAPI_SOURCE_FILES)) {
		const contents = await readFile(resolve(sourceDirectory, filename));
		const actualHash = createHash('sha256').update(contents).digest('hex');
		if (actualHash !== expectedHash) {
			throw new Error(
				`${filename} does not match pinned PokeAPI commit ${POKEAPI_SOURCE_COMMIT}: expected ${expectedHash}, found ${actualHash}`
			);
		}
	}
}

/**
 * @param {{ sourceDirectory: string; destination?: string; maxPokedexNumber?: number; verifyPinnedSource?: boolean }} options
 */
export async function generateSpeciesCatalogue({
	sourceDirectory,
	destination = resolve('data/pokemon-species.gen1-5.v1.json'),
	maxPokedexNumber = 649,
	verifyPinnedSource = true
}) {
	if (verifyPinnedSource) await verifyPinnedSources(sourceDirectory);
	const pokemonRows = await readCsv(sourceDirectory, 'pokemon.csv', [
		'id',
		'identifier',
		'species_id',
		'is_default'
	]);
	const speciesRows = await readCsv(sourceDirectory, 'pokemon_species.csv', [
		'id',
		'generation_id'
	]);
	const speciesNameRows = await readCsv(sourceDirectory, 'pokemon_species_names.csv', [
		'pokemon_species_id',
		'local_language_id',
		'name'
	]);
	const statRows = await readCsv(sourceDirectory, 'pokemon_stats.csv', [
		'pokemon_id',
		'stat_id',
		'base_stat'
	]);
	const pokemonTypeRows = await readCsv(sourceDirectory, 'pokemon_types.csv', [
		'pokemon_id',
		'type_id',
		'slot'
	]);
	const typeRows = await readCsv(sourceDirectory, 'types.csv', ['id', 'identifier']);
	const typeNameRows = await readCsv(sourceDirectory, 'type_names.csv', [
		'type_id',
		'local_language_id',
		'name'
	]);

	const pokemonBySpecies = new Map(
		pokemonRows
			.filter(
				({ species_id, is_default }) => Number(species_id) <= maxPokedexNumber && is_default === '1'
			)
			.map(({ id, identifier, species_id }) => [Number(species_id), { id: Number(id), identifier }])
	);
	const generations = new Map(
		speciesRows
			.filter(({ id }) => Number(id) <= maxPokedexNumber)
			.map(({ id, generation_id }) => [Number(id), Number(generation_id)])
	);
	const names = new Map(
		speciesNameRows
			.filter(
				({ pokemon_species_id, local_language_id }) =>
					Number(pokemon_species_id) <= maxPokedexNumber && local_language_id === '9'
			)
			.map(({ pokemon_species_id, name }) => [Number(pokemon_species_id), name])
	);
	const supportedTypeIds = new Set(typeRows.map(({ id }) => Number(id)));
	const typeNames = new Map(
		typeNameRows
			.filter(
				({ type_id, local_language_id }) =>
					local_language_id === '9' && supportedTypeIds.has(Number(type_id))
			)
			.map(({ type_id, name }) => [Number(type_id), name.toLowerCase()])
	);
	/** @type {Map<number, string[]>} */
	const types = new Map();
	for (const { pokemon_id, type_id, slot } of pokemonTypeRows) {
		const pokemonId = Number(pokemon_id);
		const typeName = typeNames.get(Number(type_id));
		if (!typeName) continue;
		const values = types.get(pokemonId) ?? [];
		values[Number(slot) - 1] = typeName;
		types.set(pokemonId, values);
	}
	/** @type {Map<number, number[]>} */
	const stats = new Map();
	for (const { pokemon_id, stat_id, base_stat } of statRows) {
		const pokemonId = Number(pokemon_id);
		const values = stats.get(pokemonId) ?? [];
		values[Number(stat_id) - 1] = Number(base_stat);
		stats.set(pokemonId, values);
	}

	const bundledSpecies = new Set(assetMetadata.bundledSpecies);
	const species = [];
	for (let pokedexNumber = 1; pokedexNumber <= maxPokedexNumber; pokedexNumber++) {
		const pokemon = pokemonBySpecies.get(pokedexNumber);
		const baseStats = pokemon ? stats.get(pokemon.id) : undefined;
		const pokemonTypes = pokemon ? types.get(pokemon.id) : undefined;
		const generation = generations.get(pokedexNumber);
		if (
			!pokemon ||
			!names.get(pokedexNumber) ||
			!generation ||
			!baseStats ||
			baseStats.length !== 6 ||
			!pokemonTypes
		) {
			throw new Error(`Incomplete PokeAPI source data for National Pokédex #${pokedexNumber}`);
		}
		const hasBundledAssets = bundledSpecies.has(pokemon.identifier);
		species.push({
			pokedexNumber,
			name: names.get(pokedexNumber),
			generation,
			types: pokemonTypes,
			baseStats: {
				hp: baseStats[0],
				attack: baseStats[1],
				defense: baseStats[2],
				specialAttack: baseStats[3],
				specialDefense: baseStats[4],
				speed: baseStats[5],
				total: baseStats.reduce((sum, stat) => sum + stat, 0)
			},
			provenance,
			assets: {
				portrait: hasBundledAssets ? 'bundled' : 'fallback',
				walkAnimation: hasBundledAssets ? 'bundled' : 'fallback',
				fallbackSpecies: hasBundledAssets ? null : assetMetadata.fallbackSpecies
			}
		});
	}

	await mkdir(dirname(destination), { recursive: true });
	const prettierConfig = (await resolveConfig(destination)) ?? {};
	const output = await format(JSON.stringify({ schemaVersion: 1, provenance, species }), {
		...prettierConfig,
		filepath: destination
	});
	await writeFile(destination, output);
	return { schemaVersion: 1, provenance, species };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === invokedPath) {
	const sourceDirectory = process.argv[2];
	if (!sourceDirectory) {
		throw new Error('Usage: node scripts/generate-species-catalogue.mjs <PokeAPI CSV directory>');
	}
	await generateSpeciesCatalogue({ sourceDirectory });
}
