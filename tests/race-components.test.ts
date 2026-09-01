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
			.replace(
				"'$lib/raceMoveEvents'",
				JSON.stringify(new URL('../src/lib/raceMoveEvents.ts', import.meta.url).href)
			)
	);
	return {
		component: (await import(pathToFileURL(modulePath).href)).default,
		cleanup: () => rm(directory, { recursive: true })
	};
}

const track = {
	id: 'track-1',
	name: 'Indigo Circuit',
	length: 1_200,
	totalLength: 1_200,
	width: 40,
	surface: 'grass',
	hazards: [{ type: 'tight-turn', severity: 0.25, checkpointIndex: 2 }],
	corneringDemand: 0.35,
	speedBias: 0.2,
	risk: 0.15,
	compatibleFormats: ['circuit']
};
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
		assert.equal((body.match(/Grass\s*·\s*1,200 px\s*·\s*15% risk/g) ?? []).length, 2);
		assert.match(body, /Starts in 2m 5s/);
		assert.match(body, /Starting soon/);
		assert.match(body, /Live/);
		assert.match(body, /2\s+participants/);
		assert.match(body, /href="\/races\/race-live"/);
	} finally {
		await cleanup();
	}
});

test('completed race cards label non-finishers with their recorded incident', async () => {
	const { component, cleanup } = await serverComponent('RaceDiscovery');
	try {
		const body = render(component, {
			props: {
				races: [
					{
						...baseRace,
						id: 'race-dnf',
						status: 'settled',
						startTime: '2026-08-15T12:00:00Z',
						finishingOrder: ['racer-2'],
						nonFinishers: [
							{
								racerId: 'racer-1',
								reason: 'oil-slick',
								summary: 'Bolt did not finish after an oil slick incident.',
								occurredAt: '2026-08-15T12:30:00Z'
							}
						]
					}
				],
				racers,
				racetracks: [track]
			}
		}).body;

		assert.match(body, /DNF[^<]*Bolt[^<]*oil slick/i);
		assert.doesNotMatch(body, /undefined\.\s*Bolt/i);
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

test('completed race detail displays significant buff activation and expiry events', async () => {
	const { component, cleanup } = await serverComponent('RaceDetail');
	try {
		const eventRacers = [
			{
				...racers[0],
				currentRace: {
					significantEvents: [
						{
							id: 'activation-1',
							type: 'move_activated',
							occurredAt: '2026-08-15T12:00:01Z',
							racerId: 'racer-1',
							racerName: 'Bolt',
							moveId: 'second-wind',
							moveName: 'Second Wind',
							summary: 'Bolt activated Second Wind for a temporary speed boost.'
						},
						{
							id: 'expiry-1',
							type: 'move_expired',
							occurredAt: '2026-08-15T12:00:03Z',
							racerId: 'racer-1',
							racerName: 'Bolt',
							moveId: 'second-wind',
							moveName: 'Second Wind',
							summary: 'Second Wind expired for Bolt.'
						}
					]
				}
			}
		];
		const body = render(component, {
			props: {
				race: { ...baseRace, status: 'settled', startTime: '2026-08-15T12:00:00Z' },
				racers: eventRacers,
				racetrack: track
			}
		}).body;

		assert.match(body, /Race highlights/i);
		assert.match(body, /Bolt activated Second Wind/);
		assert.match(body, /Second Wind expired for Bolt/);
	} finally {
		await cleanup();
	}
});

test('race detail identifies the second track and its racing characteristics', async () => {
	const { component, cleanup } = await serverComponent('RaceDetail');
	try {
		const coastalTrack = {
			id: 'coastal-loop',
			name: 'Coastal Loop',
			length: 1_600,
			totalLength: 1_600,
			width: 48,
			surface: 'sand',
			hazards: [{ type: 'crosswind', severity: 0.6, checkpointIndex: 2 }],
			corneringDemand: 0.7,
			speedBias: -0.25,
			risk: 0.4,
			compatibleFormats: ['circuit']
		};
		const race = {
			...baseRace,
			id: 'coastal-result',
			status: 'settled',
			racetrack: coastalTrack.id,
			startTime: '2026-08-15T12:00:00Z'
		};
		const body = render(component, { props: { race, racers, racetrack: coastalTrack } }).body;

		assert.match(body, /Coastal Loop/);
		assert.match(body, /Sand/);
		assert.match(body, /1,600 px/);
		assert.match(body, /48 px/);
		assert.match(body, /Crosswind/);
		assert.match(body, /Circuit/);
		assert.match(body, /Cornering demand[\s\S]*70%/);
		assert.match(body, /Speed bias[\s\S]*-25%/);
		assert.match(body, /Risk[\s\S]*40%/);
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

test('discovery and detail clearly identify an unranked Exhibition Race and its consequences', async () => {
	const exhibition = {
		...baseRace,
		id: 'race-exhibition',
		name: 'Premier Showcase',
		status: 'pending',
		startTime: '2026-08-16T12:00:00Z',
		raceFormat: { type: 'exhibition', ranked: false, rulesVersion: 'exhibition-race-v1' },
		eligibilityPolicy: {
			activeOnly: true,
			healthEligible: true,
			leagueId: 'league-1',
			retired: false,
			trainerRequired: true
		},
		movePolicy: { enabled: false, rulesVersion: 'moves-disabled-v1' },
		prizeScale: 0.25,
		riskPolicy: { level: 'low', incidentMultiplier: 0.5, trackRisk: 0.15 },
		wageringPolicy: { enabled: false, markets: [] }
	};
	const discovery = await serverComponent('RaceDiscovery');
	const detail = await serverComponent('RaceDetail');
	try {
		const card = render(discovery.component, {
			props: { races: [exhibition], racers, racetracks: [track] }
		}).body;
		const page = render(detail.component, {
			props: { race: exhibition, racers, racetrack: track }
		}).body;
		assert.match(card, /Exhibition Race/i);
		assert.match(page, /Exhibition Race/i);
		assert.match(page, /Unranked.*no league points/i);
		assert.match(page, /Prize scale[\s\S]*Reduced 0\.25× format\s+scale/i);
		assert.match(page, /Risk policy[\s\S]*low[\s\S]*50% incident multiplier/i);
		assert.match(page, /Wagering[\s\S]*Not offered/i);
	} finally {
		await discovery.cleanup();
		await detail.cleanup();
	}
});

test('discovery and detail identify retired-only Legends Exhibition consequences', async () => {
	const legendsExhibition = {
		...baseRace,
		id: 'race-legends',
		name: 'Champion Reunion',
		status: 'pending',
		startTime: '2026-08-16T12:00:00Z',
		raceFormat: {
			type: 'legends_exhibition',
			ranked: false,
			rulesVersion: 'legends-exhibition-v1'
		},
		eligibilityPolicy: {
			activeOnly: false,
			healthEligible: false,
			leagueId: 'league-1',
			retired: true,
			trainerRequired: false
		},
		movePolicy: { enabled: false, rulesVersion: 'moves-disabled-v1' },
		prizeScale: 0.1,
		riskPolicy: { level: 'low', incidentMultiplier: 0.25, trackRisk: 0.15 },
		wageringPolicy: { enabled: false, markets: [] }
	};
	const discovery = await serverComponent('RaceDiscovery');
	const detail = await serverComponent('RaceDetail');
	try {
		const card = render(discovery.component, {
			props: { races: [legendsExhibition], racers, racetracks: [track] }
		}).body;
		const page = render(detail.component, {
			props: { race: legendsExhibition, racers, racetrack: track }
		}).body;
		assert.match(card, /Legends Exhibition/i);
		assert.match(page, /Legends Exhibition/i);
		assert.match(page, /Retired racers only/i);
		assert.match(page, /Unranked.*no league points/i);
		assert.match(page, /Prize scale[\s\S]*Reduced 0\.1× format\s+scale/i);
		assert.match(page, /Risk policy[\s\S]*low[\s\S]*25% incident multiplier/i);
		assert.match(page, /Moves[\s\S]*Disabled/i);
		assert.match(page, /Wagering[\s\S]*Not offered/i);
	} finally {
		await discovery.cleanup();
		await detail.cleanup();
	}
});

test('Grand Prix detail distinguishes overall and class finishing positions', async () => {
	const grandPrix = {
		...baseRace,
		id: 'grand-prix-result',
		name: 'Multi-Class Grand Prix',
		status: 'settled',
		startTime: '2026-09-04T12:00:00Z',
		raceFormat: { type: 'grand_prix', ranked: true, rulesVersion: 'grand-prix-v1' },
		winner: 'racer-1',
		finishingOrder: ['racer-1', 'racer-2'],
		classResults: [
			{
				racerId: 'racer-1',
				classId: 'league-1',
				className: 'Premier',
				overallPosition: 1,
				classPosition: 1
			},
			{
				racerId: 'racer-2',
				classId: 'league-2',
				className: 'Challenger',
				overallPosition: 2,
				classPosition: 1
			}
		]
	};
	const { component, cleanup } = await serverComponent('RaceDetail');
	try {
		const body = render(component, { props: { race: grandPrix, racers, racetrack: track } }).body;
		assert.match(body, /Overall 1st/);
		assert.match(body, /Premier class 1st/);
		assert.match(body, /Overall 2nd/);
		assert.match(body, /Challenger class 1st/);
	} finally {
		await cleanup();
	}
});
