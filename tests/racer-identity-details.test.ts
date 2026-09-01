import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

test('racer details distinguish canonical species stats from individual lifecycle traits', async () => {
	const source = await readFile(
		new URL('../src/lib/components/RacerIdentityDetails.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/lib/components/RacerIdentityDetails.svelte',
		generate: 'server'
	});
	const directory = await mkdtemp(join(tmpdir(), 'racer-identity-details-'));
	const modulePath = join(directory, 'RacerIdentityDetails.js');
	await writeFile(
		modulePath,
		js.code.replace(
			"'svelte/internal/server'",
			JSON.stringify(
				new URL('../node_modules/svelte/src/internal/server/index.js', import.meta.url).href
			)
		)
	);

	try {
		const component = (await import(pathToFileURL(modulePath).href)).default;
		const body = render(component, {
			props: {
				racer: {
					careerStartedAt: '2026-09-01T15:30:00.000Z',
					careerLoad: 12,
					traits: {
						durability: 72,
						resilience: 11,
						temperament: 52,
						consistency: 58,
						potential: 58,
						longevity: 64
					},
					expand: {
						pokemon: {
							name: 'Pikachu',
							stats: {
								hp: 35,
								attack: 55,
								defense: 40,
								specialAttack: 50,
								specialDefense: 50,
								speed: 90,
								total: 320
							}
						}
					}
				}
			}
		}).body;

		assert.match(body, /Species stats/);
		assert.match(body, /Pikachu/);
		assert.match(body, /HP[\s\S]*35/);
		assert.match(body, /Individual traits/);
		assert.match(body, /Durability[\s\S]*72/);
		assert.match(body, /Career load[\s\S]*12 races/);
		assert.ok(body.indexOf('Species stats') < body.indexOf('Individual traits'));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
