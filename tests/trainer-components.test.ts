import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

test('trainer careers view shows aggregates, championship status and recent results', async () => {
	const source = await readFile(
		new URL('../src/lib/components/TrainerCareers.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/lib/components/TrainerCareers.svelte',
		generate: 'server'
	});
	const executable = js.code
		.replace(
			"'svelte/internal/server'",
			JSON.stringify(
				new URL('../node_modules/svelte/src/internal/server/index.js', import.meta.url).href
			)
		)
		.replace(
			"'$lib/trainerCareer'",
			JSON.stringify(new URL('../src/lib/trainerCareer.ts', import.meta.url).href)
		);
	const directory = await mkdtemp(join(tmpdir(), 'trainer-careers-'));
	const modulePath = join(directory, 'TrainerCareers.js');
	await writeFile(modulePath, executable);
	const component = (await import(pathToFileURL(modulePath).href)).default;
	const { body } = render(component, {
		props: {
			trainers: [
				{
					id: 'trainer-1',
					name: 'Misty',
					career: { starts: 4, wins: 2, podiums: 3, earnings: 90, championships: 0 }
				}
			],
			results: [
				{
					trainer: 'trainer-1',
					position: 1,
					earnings: 40,
					expand: { racer: { name: 'Starmie' }, race: { name: 'Cerulean Cup' } }
				}
			]
		}
	});

	for (const value of ['Misty', 'Starts', 'Wins', 'Podiums', 'Earnings', 'Championships']) {
		assert.match(body, new RegExp(value));
	}
	assert.match(body, /Starmie.*Cerulean Cup/);
	assert.match(body, /#1.*₽40/);
	await rm(directory, { recursive: true });
});
