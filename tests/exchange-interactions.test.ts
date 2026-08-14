import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { compile } from 'svelte/compiler';

test('exchange filters and chart range react to keyboard and pointer input', async () => {
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

	const source = await readFile(
		new URL('../src/lib/components/ExchangeFilters.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/lib/components/ExchangeFilters.svelte',
		generate: 'client'
	});
	const clientInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/client/index.js',
		import.meta.url
	).href;
	const discloseVersionUrl = new URL(
		'../node_modules/svelte/src/internal/disclose-version.js',
		import.meta.url
	).href;
	const clientApiUrl = new URL('../node_modules/svelte/src/index-client.js', import.meta.url).href;
	const executableModule = js.code
		.replace("'svelte/internal/client'", JSON.stringify(clientInternalsUrl))
		.replace("'svelte/internal/disclose-version'", JSON.stringify(discloseVersionUrl));
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'exchange-filters-'));
	const modulePath = join(temporaryDirectory, 'ExchangeFilters.js');
	await writeFile(modulePath, executableModule);

	try {
		const [{ default: ExchangeFilters }, { mount, tick, unmount }] = await Promise.all([
			import(pathToFileURL(modulePath).href),
			import(clientApiUrl)
		]);
		const target = document.querySelector('main') as HTMLElement;
		const component = mount(ExchangeFilters, { target });
		const search = target.querySelector('input[type="search"]') as HTMLInputElement;
		const watchlist = target.querySelector('input[type="checkbox"]') as HTMLInputElement;
		const reset = target.querySelector('button') as HTMLButtonElement;

		search.value = 'squirt';
		search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
		watchlist.click();
		await tick();
		assert.equal(search.value, 'squirt');
		assert.equal(watchlist.checked, true);

		reset.click();
		await tick();
		assert.equal(search.value, '');
		assert.equal(watchlist.checked, false);
		unmount(component);

		const readoutSource = await readFile(
			new URL('../src/lib/components/ExchangeReadout.svelte', import.meta.url),
			'utf8'
		);
		const readoutCode = compile(readoutSource, {
			filename: 'src/lib/components/ExchangeReadout.svelte',
			generate: 'client'
		}).js.code;
		const presentationUrl = new URL('../src/lib/exchangePresentation.ts', import.meta.url).href;
		const readoutModulePath = join(temporaryDirectory, 'ExchangeReadout.js');
		await writeFile(
			readoutModulePath,
			readoutCode
				.replace("'svelte/internal/client'", JSON.stringify(clientInternalsUrl))
				.replace("'svelte/internal/disclose-version'", JSON.stringify(discloseVersionUrl))
				.replace("'$lib/exchangePresentation'", JSON.stringify(presentationUrl))
		);
		const { default: ExchangeReadout } = await import(pathToFileURL(readoutModulePath).href);
		const readout = mount(ExchangeReadout, {
			target,
			props: {
				selectedRange: '1d',
				hasPriceHistory: true,
				snapshot: {
					currentPrice: 10,
					daily: { high: 10, low: 8 },
					weeks52: { high: 12, low: 6 }
				},
				racer: { financials: {}, expand: {}, stats: {}, raceHistory: {} }
			}
		});
		const sevenDays = [...target.querySelectorAll('button')].find(
			(button) => button.textContent === '7d'
		) as HTMLButtonElement;
		sevenDays.click();
		await tick();
		assert.equal(sevenDays.getAttribute('aria-pressed'), 'true');
		unmount(readout);
	} finally {
		await rm(temporaryDirectory, { recursive: true });
		dom.window.close();
	}
});
