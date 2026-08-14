import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

import { load } from '../src/routes/roadmap/+page';

test('roadmap route renders real product themes grouped by delivery status', async () => {
	const componentSource = await readFile(
		new URL('../src/routes/roadmap/+page.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(componentSource, {
		filename: 'src/routes/roadmap/+page.svelte',
		generate: 'server'
	});
	const serverInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/server/index.js',
		import.meta.url
	).href;
	const executableModule = js.code.replace(
		"'svelte/internal/server'",
		JSON.stringify(serverInternalsUrl)
	);
	const { default: RoadmapPage } = await import(
		`data:text/javascript;base64,${Buffer.from(executableModule).toString('base64')}`
	);
	const { body } = render(RoadmapPage, { props: { data: load() } });

	for (const text of [
		'active',
		'planned',
		'completed',
		'Live racing',
		'Wagering and exchange',
		'League foundations'
	]) {
		assert.match(body, new RegExp(`>${text}<`, 'i'));
	}
	assert.doesNotMatch(body, /Item [123]/i);
});
