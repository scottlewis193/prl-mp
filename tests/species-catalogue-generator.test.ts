import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { generateSpeciesCatalogue } from '../scripts/generate-species-catalogue.mjs';

test('generator consumes the pinned PokeAPI v2 filenames and authoritative generation column', async () => {
	const outputDirectory = await mkdtemp(join(tmpdir(), 'prl-species-generator-'));
	const destination = join(outputDirectory, 'catalogue.json');
	try {
		await generateSpeciesCatalogue({
			sourceDirectory: resolve(import.meta.dirname, 'fixtures/pokeapi-v2'),
			destination,
			maxPokedexNumber: 3,
			verifyPinnedSource: false
		});
		const generated = JSON.parse(await readFile(destination, 'utf8'));

		assert.deepEqual(
			generated.species.map(({ pokedexNumber, generation, types }: Record<string, unknown>) => ({
				pokedexNumber,
				generation,
				types
			})),
			[
				{ pokedexNumber: 1, generation: 5, types: ['grass', 'poison'] },
				{ pokedexNumber: 2, generation: 2, types: ['grass', 'poison'] },
				{ pokedexNumber: 3, generation: 4, types: ['grass', 'poison'] }
			]
		);
		assert.equal(generated.provenance.version, '286d7a071bc50ec4a57e3f3f506a13220ce6f903');
	} finally {
		await rm(outputDirectory, { recursive: true, force: true });
	}
});
