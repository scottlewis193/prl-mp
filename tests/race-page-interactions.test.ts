import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { compile } from 'svelte/compiler';

test('the open race index loads realtime data then visibly reclassifies race and participant updates', async () => {
	const dom = new JSDOM('<main></main>', { pretendToBeVisual: true });
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		Element: dom.window.Element,
		Node: dom.window.Node,
		Text: dom.window.Text,
		Comment: dom.window.Comment,
		navigator: dom.window.navigator,
		Event: dom.window.Event
	});
	const directory = await mkdtemp(join(tmpdir(), 'race-page-'));
	const clientInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/client/index.js',
		import.meta.url
	).href;
	const discloseVersionUrl = new URL(
		'../node_modules/svelte/src/internal/disclose-version.js',
		import.meta.url
	).href;
	const clientApiUrl = new URL('../node_modules/svelte/src/index-client.js', import.meta.url).href;

	try {
		const discoverySource = await readFile(
			new URL('../src/lib/components/RaceDiscovery.svelte', import.meta.url),
			'utf8'
		);
		const discoveryCode = compile(discoverySource, {
			filename: 'src/lib/components/RaceDiscovery.svelte',
			generate: 'client'
		}).js.code;
		const discoveryModulePath = join(directory, 'RaceDiscovery.js');
		await writeFile(
			discoveryModulePath,
			discoveryCode
				.replace("'svelte/internal/client'", JSON.stringify(clientInternalsUrl))
				.replace("'svelte/internal/disclose-version'", JSON.stringify(discloseVersionUrl))
				.replace(
					"'$lib/raceDiscovery'",
					JSON.stringify(new URL('../src/lib/raceDiscovery.ts', import.meta.url).href)
				)
		);

		const pageSource = await readFile(
			new URL('../src/lib/components/RaceDiscoveryPage.svelte', import.meta.url),
			'utf8'
		);
		const pageCode = compile(pageSource, {
			filename: 'src/lib/components/RaceDiscoveryPage.svelte',
			generate: 'client'
		}).js.code;
		const pageModulePath = join(directory, 'RaceDiscoveryPage.js');
		await writeFile(
			pageModulePath,
			pageCode
				.replace("'svelte/internal/client'", JSON.stringify(clientInternalsUrl))
				.replace("'svelte/internal/disclose-version'", JSON.stringify(discloseVersionUrl))
				.replace("'svelte'", JSON.stringify(clientApiUrl))
				.replace(
					"'./RaceDiscovery.svelte'",
					JSON.stringify(pathToFileURL(discoveryModulePath).href)
				)
				.replace(
					"'$lib/raceDiscoveryUpdates'",
					JSON.stringify(new URL('../src/lib/raceDiscoveryUpdates.ts', import.meta.url).href)
				)
		);

		const callbacks = new Map<string, (event: any) => void>();
		const subscriptionResolvers = new Map<string, (stop: () => void) => void>();
		const client = {
			collection(name: string) {
				return {
					subscribe: (_topic: string, callback: (event: any) => void) => {
						callbacks.set(name, callback);
						return new Promise<() => void>((resolve) => subscriptionResolvers.set(name, resolve));
					}
				};
			}
		};
		const [{ default: RaceDiscoveryPage }, { mount, tick, unmount }] = await Promise.all([
			import(pathToFileURL(pageModulePath).href),
			import(clientApiUrl)
		]);
		const target = document.querySelector('main') as HTMLElement;
		const component = mount(RaceDiscoveryPage, {
			target,
			props: {
				initialRaces: [
					{
						id: 'race-1',
						name: 'Indigo Cup',
						status: 'pending',
						racetrack: 'track-1',
						winner: '',
						finishingOrder: [],
						startTime: '2026-08-15T13:00:00Z',
						endTime: '2026-08-15T13:30:00Z',
						totalLaps: 3
					}
				],
				initialRacers: [{ id: 'racer-1', name: 'Bolt', race: '' }],
				racetracks: [{ id: 'track-1', name: 'Indigo Circuit' }],
				client
			}
		});
		await tick();
		assert.match(target.textContent ?? '', /Loading races/i);

		subscriptionResolvers.get('races')?.(() => undefined);
		await new Promise((resolve) => setTimeout(resolve, 0));
		subscriptionResolvers.get('racers')?.(() => undefined);
		await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
		assert.match(target.textContent ?? '', /Upcoming races/i);
		assert.equal(target.querySelector('a[href="/races/race-1"]')?.textContent, 'View race');

		callbacks.get('races')?.({
			action: 'update',
			record: { id: 'race-1', status: 'running' }
		});
		callbacks.get('racers')?.({
			action: 'update',
			record: { id: 'racer-1', name: 'Bolt', race: 'race-1' }
		});
		await tick();
		assert.match(target.textContent ?? '', /Live now[\s\S]*Indigo Cup/);
		assert.match(target.textContent ?? '', /1\s+participant/);
		unmount(component);
	} finally {
		await rm(directory, { recursive: true });
		dom.window.close();
	}
});
