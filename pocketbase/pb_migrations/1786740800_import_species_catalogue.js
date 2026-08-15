/// <reference path="../pb_data/types.d.ts" />

const cataloguePath = $filepath.join($os.getwd(), 'data', 'pokemon-species.gen1-5.v1.json');
const assetMetadataPath = $filepath.join($os.getwd(), 'data', 'pokemon-assets.v1.json');

function catalogueRecordId(pokedexNumber) {
	return 'prlpk' + String(pokedexNumber).padStart(10, '0');
}

migrate(
	(app) => {
		const catalogue = JSON.parse(toString($os.readFile(cataloguePath))).species;
		const assetMetadata = JSON.parse(toString($os.readFile(assetMetadataPath)));
		if (catalogue.length !== 649) {
			throw new Error(
				'Species catalogue migration expected 649 entries, found ' + catalogue.length
			);
		}

		const pokemon = app.findCollectionByNameOrId('pokemon');
		// This field snapshot is intentionally self-contained: applied migrations must remain stable
		// if the runtime schema verifier evolves in a later release.
		pokemon.fields.add(
			new NumberField({ name: 'pokedexNumber', min: 1, max: 649, onlyInt: true }),
			new NumberField({ name: 'generation', min: 1, max: 5, onlyInt: true }),
			new JSONField({ name: 'provenance', maxSize: 10000 }),
			new JSONField({ name: 'assetState', maxSize: 10000 })
		);
		app.save(pokemon);

		const existingByName = {};
		for (const record of app.findAllRecords('pokemon')) {
			const key = String(record.get('name')).toLowerCase();
			if (existingByName[key]) throw new Error('Duplicate existing pokemon name: ' + key);
			existingByName[key] = record;
		}

		const seenNumbers = {};
		for (const entry of catalogue) {
			if (seenNumbers[entry.pokedexNumber]) {
				throw new Error('Duplicate National Pokédex entry: ' + entry.pokedexNumber);
			}
			seenNumbers[entry.pokedexNumber] = true;
			let record = existingByName[entry.name.toLowerCase()];
			if (!record) {
				record = new Record(pokemon);
				record.set('id', catalogueRecordId(entry.pokedexNumber));
				record.set('animData', {});
				record.set('moves', []);
			}
			record.set('pokedexNumber', entry.pokedexNumber);
			record.set('name', entry.name);
			record.set('generation', entry.generation);
			record.set('types', entry.types);
			record.set('stats', entry.baseStats);
			record.set('provenance', entry.provenance);
			record.set('assetState', entry.assets);
			if (entry.assets.walkAnimation === 'fallback') {
				record.set('animData', assetMetadata.fallbackWalkAnimation);
			}
			record.set('hp', entry.baseStats.hp);
			record.set('attack', entry.baseStats.attack);
			record.set('defense', entry.baseStats.defense);
			record.set('speed', entry.baseStats.speed);
			app.save(record);
		}

		const imported = app.findAllRecords('pokemon');
		if (imported.length !== 649) {
			throw new Error(
				'Species catalogue verification expected exactly 649 records, found ' + imported.length
			);
		}
		for (let pokedexNumber = 1; pokedexNumber <= 649; pokedexNumber++) {
			if (!seenNumbers[pokedexNumber]) {
				throw new Error('Species catalogue is missing National Pokédex entry: ' + pokedexNumber);
			}
		}

		for (const name of [
			'pokedexNumber',
			'name',
			'generation',
			'types',
			'stats',
			'provenance',
			'assetState'
		]) {
			pokemon.fields.getByName(name).required = true;
		}
		pokemon.indexes = [
			...pokemon.indexes,
			'CREATE UNIQUE INDEX idx_pokemon_pokedex_number ON pokemon (pokedexNumber)'
		];
		app.save(pokemon);
	},
	(app) => {
		const pokemon = app.findCollectionByNameOrId('pokemon');
		pokemon.indexes = pokemon.indexes.filter(
			(index) => !index.includes('idx_pokemon_pokedex_number')
		);
		pokemon.fields.getByName('types').required = false;
		pokemon.fields.getByName('stats').required = false;
		for (const name of ['assetState', 'provenance', 'generation', 'pokedexNumber']) {
			pokemon.fields.removeByName(name);
		}
		app.save(pokemon);

		for (const record of app.findAllRecords('pokemon')) {
			if (record.id.startsWith('prlpk')) app.delete(record);
		}
	}
);
