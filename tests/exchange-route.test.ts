import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

test('exchange renders selected range, real information and missing values', async () => {
	const source = await readFile(
		new URL('../src/lib/components/ExchangeReadout.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/lib/components/ExchangeReadout.svelte',
		generate: 'server'
	});
	const serverInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/server/index.js',
		import.meta.url
	).href;
	const presentationUrl = new URL('../src/lib/exchangePresentation.ts', import.meta.url).href;
	const executableModule = js.code
		.replace("'svelte/internal/server'", JSON.stringify(serverInternalsUrl))
		.replace("'$lib/exchangePresentation'", JSON.stringify(presentationUrl));
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'exchange-readout-'));
	const modulePath = join(temporaryDirectory, 'ExchangeReadout.js');
	await writeFile(modulePath, executableModule);
	const { default: ExchangeReadout } = await import(pathToFileURL(modulePath).href);
	const { body } = render(ExchangeReadout, {
		props: {
			selectedRange: '1d',
			hasPriceHistory: true,
			holding: { quantity: 5, costBasis: 40 },
			snapshot: {
				currentPrice: 10,
				daily: { high: 10, low: 8 },
				weeks52: { high: 12, low: 6 }
			},
			racer: {
				name: 'Bolt',
				expand: { pokemon: { name: 'Pikachu' } },
				stats: { level: 12, ranking: 3, speed: 90 },
				status: { injured: false, retired: false },
				raceHistory: { wins: 4, totalRaces: 10 },
				financials: {
					totalEarnings: 500,
					earningsPerShare: 5,
					issuedShares: 100,
					outstandingShares: 80,
					currentSharePrice: 999
				}
			}
		}
	});

	assert.match(body, /₽10/);
	assert.doesNotMatch(body, /₽999|WIP|₽1\.00/);
	assert.match(body, /aria-pressed="true"[^>]*>1d</);
	assert.match(body, /Total earnings/i);
	assert.match(body, /Level<\/strong><span>12/);
	assert.match(body, /Shares<\/strong><span>5/);
	assert.match(body, /Cost basis<\/strong><span>₽40/);
	assert.match(body, /Value<\/strong><span>₽50/);
	assert.match(body, /Return<\/strong><span[^>]*>₽10 \(25\.00%\)/);
	for (const range of ['7d', '1m', '3m', '6m', '1y', 'all']) {
		const { body: selectedRangeBody } = render(ExchangeReadout, {
			props: {
				selectedRange: range,
				hasPriceHistory: true,
				snapshot: {
					currentPrice: null,
					daily: { high: null, low: null },
					weeks52: { high: null, low: null }
				},
				racer: { financials: {}, expand: {}, stats: {}, raceHistory: {} }
			}
		});
		assert.match(selectedRangeBody, new RegExp(`aria-pressed="true"[^>]*>${range}`, 'i'));
	}

	const { body: missingBody } = render(ExchangeReadout, {
		props: {
			selectedRange: '1d',
			hasPriceHistory: false,
			holding: { quantity: 5, costBasis: 40 },
			snapshot: {
				currentPrice: null,
				daily: { high: null, low: null },
				weeks52: { high: null, low: null }
			},
			racer: {
				name: 'Unknown entry',
				expand: {},
				stats: {},
				raceHistory: {},
				financials: { lastPayoutAt: 'not-a-date' }
			}
		}
	});
	assert.match(missingBody, /Market Cap<\/strong><span>N\/A/);
	assert.match(missingBody, /Value<\/strong><span>N\/A/);
	assert.match(missingBody, /Status<\/strong><span>Unknown/);
	assert.doesNotMatch(missingBody, /Invalid Date/);
	await rm(temporaryDirectory, { recursive: true });
});
