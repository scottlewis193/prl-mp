import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

test('wager page shows eligible markets plus open and historical player wagers', async () => {
	const source = await readFile(
		new URL('../src/routes/wager/+page.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/routes/wager/+page.svelte',
		generate: 'server'
	});
	const serverInternalsUrl = new URL(
		'../node_modules/svelte/src/internal/server/index.js',
		import.meta.url
	).href;
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'wager-page-'));
	const modulePath = join(temporaryDirectory, 'WagerPage.js');
	await writeFile(
		modulePath,
		js.code.replace("'svelte/internal/server'", JSON.stringify(serverInternalsUrl))
	);

	try {
		const { default: WagerPage } = await import(pathToFileURL(modulePath).href);
		const { body } = render(WagerPage, {
			props: {
				data: {
					balance: 125,
					requestId: 'request-1',
					racers: [
						{ id: 'racer-a', name: 'Bolt' },
						{ id: 'racer-b', name: 'Dash' }
					],
					races: [
						{
							id: 'race-1',
							name: 'Premier Cup',
							bettingCutoff: '2026-08-15T14:00:00.000Z',
							markets: {
								winnerType: 'winner',
								winnerName: 'Race winner',
								winnerCutoff: '2026-08-15T14:00:00.000Z',
								winnerSelections: [
									{ racerId: 'racer-a', odds: 1.8 },
									{ racerId: 'racer-b', odds: 2.4 }
								]
							}
						}
					],
					openWagers: [
						{
							id: 'wager-open',
							stake: 10,
							odds: 1.8,
							potentialPayout: 18,
							status: 'open',
							expand: { race: { name: 'Premier Cup' }, selection: { name: 'Bolt' } }
						}
					],
					historicalWagers: [
						{
							id: 'wager-won',
							stake: 5,
							odds: 2.4,
							payout: 12,
							status: 'won',
							expand: { race: { name: 'Earlier Cup' }, selection: { name: 'Dash' } }
						}
					]
				}
			}
		});

		assert.match(body, /Premier Cup/);
		assert.match(body, /Race winner/);
		assert.match(body, /Closes.*15 Aug 2026.*14:00/i);
		assert.match(body, /Bolt.*1\.80/s);
		assert.match(body, /Dash.*2\.40/s);
		assert.match(body, /Open wagers/i);
		assert.match(body, /Potential payout.*₽18/s);
		assert.match(body, /Wager history/i);
		assert.match(body, /Earlier Cup/);
		assert.match(body, /Won.*Payout.*₽12/is);
		assert.match(body, /name="requestId" value="request-1"/);
	} finally {
		await rm(temporaryDirectory, { recursive: true });
	}
});
