import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { compile } from 'svelte/compiler';

test('player previews and confirms buy and sell orders through the exchange form', async () => {
	const dom = new JSDOM('<main></main>', { pretendToBeVisual: true });
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		HTMLMediaElement: dom.window.HTMLMediaElement,
		Element: dom.window.Element,
		Node: dom.window.Node,
		Text: dom.window.Text,
		Comment: dom.window.Comment,
		navigator: dom.window.navigator,
		Event: dom.window.Event,
		crypto: dom.window.crypto
	});

	const source = await readFile(
		new URL('../src/lib/components/ExchangeTradeForm.svelte', import.meta.url),
		'utf8'
	);
	const code = compile(source, {
		filename: 'src/lib/components/ExchangeTradeForm.svelte',
		generate: 'client'
	}).js.code;
	const clientInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/client/index.js',
		import.meta.url
	).href;
	const discloseVersionUrl = new URL(
		'../node_modules/svelte/src/internal/disclose-version.js',
		import.meta.url
	).href;
	const clientApiUrl = new URL('../node_modules/svelte/src/index-client.js', import.meta.url).href;
	const tradeUrl = new URL('../src/lib/exchangeTrade.ts', import.meta.url).href;
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'exchange-trade-form-'));
	const modulePath = join(temporaryDirectory, 'ExchangeTradeForm.js');
	await writeFile(
		modulePath,
		code
			.replace("'svelte/internal/client'", JSON.stringify(clientInternalsUrl))
			.replace("'svelte/internal/disclose-version'", JSON.stringify(discloseVersionUrl))
			.replace("'$lib/exchangeTrade'", JSON.stringify(tradeUrl))
	);

	try {
		const [{ default: ExchangeTradeForm }, { mount, tick, unmount }] = await Promise.all([
			import(pathToFileURL(modulePath).href),
			import(clientApiUrl)
		]);
		const submitted: Array<{
			side: string;
			quantity: number;
			idempotencyKey: string;
			expectedUnitPrice: number;
		}> = [];
		const target = document.querySelector('main') as HTMLElement;
		const component = mount(ExchangeTradeForm, {
			target,
			props: {
				unitPrice: 12.5,
				balance: 100,
				availableSupply: 20,
				ownedQuantity: 5,
				submitTrade: async (order: {
					side: string;
					quantity: number;
					idempotencyKey: string;
					expectedUnitPrice: number;
				}) => submitted.push(order)
			}
		});
		const quantity = target.querySelector('input[name="quantity"]') as HTMLInputElement;
		quantity.value = '4';
		quantity.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
		await tick();
		assert.match(target.textContent ?? '', /Total cost:\s*₽50/);

		const confirm = [...target.querySelectorAll('button')].find((button) =>
			/confirm buy/i.test(button.textContent ?? '')
		) as HTMLButtonElement;
		confirm.click();
		await tick();
		assert.equal(submitted.length, 1);
		assert.deepEqual(
			{ side: submitted[0].side, quantity: submitted[0].quantity },
			{ side: 'buy', quantity: 4 }
		);
		assert.match(submitted[0].idempotencyKey, /^[0-9a-f-]{36}$/i);
		assert.equal(submitted[0].expectedUnitPrice, 12.5);

		const sell = [...target.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === 'Sell'
		) as HTMLButtonElement;
		sell.click();
		quantity.value = '3';
		quantity.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
		await tick();
		assert.match(target.textContent ?? '', /Total proceeds:\s*₽37\.5/);
		unmount(component);
	} finally {
		await rm(temporaryDirectory, { recursive: true });
		dom.window.close();
	}
});
