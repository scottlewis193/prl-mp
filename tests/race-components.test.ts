import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

async function serverComponent(name: string) {
	const source = await readFile(
		new URL(`../src/lib/components/${name}.svelte`, import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: `src/lib/components/${name}.svelte`,
		generate: 'server'
	});
	const directory = await mkdtemp(join(tmpdir(), 'race-components-'));
	const modulePath = join(directory, `${name}.js`);
	await writeFile(
		modulePath,
		js.code
			.replace(
				"'svelte/internal/server'",
				JSON.stringify(
					new URL('../node_modules/svelte/src/internal/server/index.js', import.meta.url).href
				)
			)
			.replace(
				"'$lib/raceDiscovery'",
				JSON.stringify(new URL('../src/lib/raceDiscovery.ts', import.meta.url).href)
			)
	);
	return {
		component: (await import(pathToFileURL(modulePath).href)).default,
		cleanup: () => rm(directory, { recursive: true })
	};
}

const track = { id: 'track-1', name: 'Indigo Circuit' };
const racers = [
	{ id: 'racer-1', name: 'Bolt', race: 'race-live' },
	{ id: 'racer-2', name: 'Dash', race: 'race-live' }
];
const baseRace = {
	name: 'Indigo Cup',
	racetrack: 'track-1',
	winner: '',
	finishingOrder: [],
	prizeCurve: [30, 20],
	awardedPrizes: [],
	endTime: '2026-08-15T13:30:00Z',
	totalLaps: 3
};

test('race discovery renders useful loading and section-level empty states', async () => {
	const { component, cleanup } = await serverComponent('RaceDiscovery');
	try {
		const loading = render(component, { props: { loading: true } }).body;
		assert.match(loading, /Loading races/i);

		const empty = render(component, {
			props: { races: [], racers: [], racetracks: [], now: new Date('2026-08-15T13:00:00Z') }
		}).body;
		for (const heading of ['Live now', 'Upcoming races', 'Completed races']) {
			assert.match(empty, new RegExp(heading, 'i'));
		}
		assert.match(empty, /No races are live right now/i);
		assert.match(empty, /No upcoming races are scheduled/i);
		assert.match(empty, /No completed races yet/i);
	} finally {
		await cleanup();
	}
});

test('race cards show track, time or countdown, status and participant summary', async () => {
	const { component, cleanup } = await serverComponent('RaceDiscovery');
	try {
		const body = render(component, {
			props: {
				races: [
					{
						...baseRace,
						id: 'race-upcoming',
						status: 'countdown',
						startTime: '2026-08-15T13:02:05Z'
					},
					{
						...baseRace,
						id: 'race-live',
						status: 'running',
						startTime: '2026-08-15T12:00:00Z'
					}
				],
				racers,
				racetracks: [track],
				now: new Date('2026-08-15T13:00:00Z')
			}
		}).body;

		assert.match(body, /Indigo Circuit/);
		assert.match(body, /Starts in 2m 5s/);
		assert.match(body, /Starting soon/);
		assert.match(body, /Live/);
		assert.match(body, /2\s+participants/);
		assert.match(body, /href="\/races\/race-live"/);
	} finally {
		await cleanup();
	}
});

test('completed race detail names the winner and displays finishing results', async () => {
	const { component, cleanup } = await serverComponent('RaceDetail');
	try {
		const race = {
			...baseRace,
			id: 'race-finished',
			status: 'settled',
			startTime: '2026-08-15T12:00:00Z',
			winner: 'racer-2',
			finishingOrder: ['racer-2', 'racer-1'],
			prizeCurve: [],
			awardedPrizes: [
				{ racerId: 'racer-2', position: 1, amount: 30 },
				{ racerId: 'racer-1', position: 2, amount: 20 }
			]
		};
		const body = render(component, { props: { race, racers, racetrack: track } }).body;

		assert.match(body, /Winner/);
		assert.match(body, /Dash/);
		assert.match(body, /1st/);
		assert.match(body, /2nd/);
		assert.match(body, /30 PokéD/);
		assert.match(body, /20 PokéD/);
		assert.doesNotMatch(body, /Prize structure/i);
		assert.ok(body.indexOf('Dash') < body.indexOf('Bolt'));
	} finally {
		await cleanup();
	}
});

test('scheduled race detail displays its snapshotted prize structure', async () => {
	const { component, cleanup } = await serverComponent('RaceDetail');
	try {
		const race = {
			...baseRace,
			id: 'race-upcoming',
			status: 'pending',
			startTime: '2026-08-16T12:00:00Z'
		};
		const body = render(component, { props: { race, racers, racetrack: track } }).body;

		assert.match(body, /Prize structure/i);
		assert.match(body, /1st/);
		assert.match(body, /30 PokéD/);
		assert.match(body, /2nd/);
		assert.match(body, /20 PokéD/);
	} finally {
		await cleanup();
	}
});
