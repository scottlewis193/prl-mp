import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

async function serverDashboard() {
	const source = await readFile(
		new URL('../src/lib/components/Dashboard.svelte', import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: 'src/lib/components/Dashboard.svelte',
		generate: 'server'
	});
	const directory = await mkdtemp(join(tmpdir(), 'dashboard-component-'));
	const modulePath = join(directory, 'Dashboard.js');
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
				"'$lib/exchangePresentation'",
				JSON.stringify(new URL('../src/lib/exchangePresentation.ts', import.meta.url).href)
			)
			.replace(
				"'$lib/raceDiscovery'",
				JSON.stringify(new URL('../src/lib/raceDiscovery.ts', import.meta.url).href)
			)
	);
	return {
		component: (await import(pathToFileURL(modulePath).href)).default,
		modulePath,
		cleanup: () => rm(directory, { recursive: true })
	};
}

async function serverDashboardPage() {
	const dashboard = await serverDashboard();
	const source = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	const { js } = compile(source, { filename: 'src/routes/+page.svelte', generate: 'server' });
	const directory = await mkdtemp(join(tmpdir(), 'dashboard-page-'));
	const modulePath = join(directory, 'Page.js');
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
				"'$lib/components/Dashboard.svelte'",
				JSON.stringify(pathToFileURL(dashboard.modulePath).href)
			)
	);
	return {
		component: (await import(pathToFileURL(modulePath).href)).default,
		cleanup: async () => {
			await dashboard.cleanup();
			await rm(directory, { recursive: true });
		}
	};
}

const populatedDashboard = {
	account: { balance: 9_970, change: -30, period: 'Last 24 hours' as const },
	wagering: {
		count: 4,
		open: 1,
		wins: 1,
		losses: 1,
		refunds: 1,
		totalStaked: 50,
		totalPayout: 55,
		profit: 15
	},
	trading: { trades: 3, buys: 2, sells: 1 },
	portfolio: {
		costBasis: 100,
		marketValue: 120,
		gain: 20,
		gainPercent: 20,
		holdings: [
			{
				racerId: 'racer-1',
				racerName: 'Bolt',
				quantity: 10,
				costBasis: 100,
				currentPrice: 12,
				marketValue: 120,
				gain: 20,
				gainPercent: 20
			}
		]
	},
	upcomingRaces: [
		{
			id: 'race-upcoming',
			name: 'Johto Sprint',
			status: 'pending',
			trackName: 'Johto Circuit',
			startTime: '2026-08-15T13:00:00Z'
		}
	],
	recentResults: [
		{
			id: 'race-recent',
			name: 'Indigo Cup',
			trackName: 'Indigo Circuit',
			winnerName: 'Bolt',
			startTime: '2026-08-15T10:00:00Z'
		}
	],
	watchedActivity: [
		{
			racerId: 'racer-1',
			racerName: 'Bolt',
			description: 'Price moved to ₽12 · Race win',
			timestamp: '2026-08-15T11:30:00Z'
		}
	],
	leagueTables: [
		{
			leagueId: 'league-1',
			leagueName: 'Starter League',
			seasonName: 'Season 1',
			rows: [
				{
					position: 1,
					racerId: 'racer-1',
					racerName: 'Bolt',
					points: 25,
					starts: 2,
					wins: 1,
					podiums: 2,
					bestFinish: 1,
					recentForm: [1, 2],
					movementZone: 'promotion' as const
				},
				{
					position: 2,
					racerId: 'racer-2',
					racerName: 'Dash',
					points: 18,
					starts: 2,
					wins: 0,
					podiums: 1,
					bestFinish: 2,
					recentForm: [2, 4],
					movementZone: 'relegation' as const
				}
			]
		}
	],
	priorSeasons: [
		{
			seasonId: 'season-0',
			seasonName: 'Season 0',
			endedAt: '2026-07-31T12:00:00Z',
			leagueTables: [
				{
					leagueId: 'league-1',
					leagueName: 'Starter League',
					rows: [
						{
							position: 1,
							racerId: 'racer-1',
							racerName: 'Bolt',
							points: 60,
							starts: 5,
							wins: 3,
							podiums: 4,
							bestFinish: 1,
							recentForm: [1, 1, 2, 3, 1],
							awardName: 'Season 0 Starter League champion'
						}
					]
				}
			]
		}
	],
	racerMovementHistory: [
		{
			seasonName: 'Season 0',
			racerId: 'racer-2',
			racerName: 'Dash',
			direction: 'promoted' as const,
			fromLeagueName: 'Academy League',
			toLeagueName: 'Starter League',
			fromPosition: 1,
			occurredAt: '2026-07-31T12:00:00Z'
		}
	],
	news: {
		items: [
			{
				id: 'news-1',
				headline: 'Bolt wins Indigo Cup',
				summary: 'Bolt won at Indigo Circuit; Dash finished second.',
				category: 'race_result' as const,
				importance: 70,
				publishedAt: '2026-09-01T14:05:00Z',
				links: [
					{
						kind: 'race' as const,
						id: 'race-recent',
						label: 'Indigo Cup',
						href: '/races/race-recent'
					},
					{ kind: 'racer' as const, id: 'racer-1', label: 'Bolt', href: '/exchange' },
					{ kind: 'trainer' as const, id: 'trainer-1', label: 'Misty', href: '/trainers' }
				]
			}
		],
		page: 1,
		totalPages: 2,
		category: 'race_result'
	}
};

test('dashboard renders live account, holdings, race and watched-racer information', async () => {
	const { component, cleanup } = await serverDashboard();
	try {
		const body = render(component, { props: { dashboard: populatedDashboard } }).body;
		assert.match(body, /₽9,970/);
		assert.match(body, /-₽30/);
		assert.match(body, /Last 24 hours/);
		assert.match(body, /Wagering activity/i);
		assert.match(body, /4 wagers/i);
		assert.match(body, /1 win/i);
		assert.match(body, /1 loss/i);
		assert.match(body, /1 refund/i);
		assert.match(body, /Staked.*₽50/is);
		assert.match(body, /Payout.*₽55/is);
		assert.match(body, /Settled P\/L.*\+₽15/is);
		assert.match(body, /Holdings performance/i);
		assert.match(body, /3 trades.*2 buys.*1 sell/is);
		assert.match(body, /Bolt/);
		assert.match(body, /₽120/);
		assert.match(body, /\+20\.00%/);
		assert.match(body, /Johto Sprint/);
		assert.match(body, /Johto Circuit/);
		assert.match(body, /Indigo Cup/);
		assert.match(body, /Winner: Bolt/);
		assert.match(body, /Price moved to ₽12 · Race win/);
		assert.match(body, /Season 1 standings/i);
		assert.match(body, /Starter League/);
		assert.match(body, /Position.*Points.*Starts.*Wins.*Podiums.*Best.*Recent form.*Movement/is);
		assert.match(body, /Bolt.*25.*2.*1.*2.*1.*1.*2.*Promotion/is);
		assert.match(body, /Dash.*18.*2.*0.*1.*2.*2.*4.*Relegation/is);
		assert.match(body, /Previous seasons/i);
		assert.match(
			body,
			/Previous seasons.*Position.*Points.*Starts.*Wins.*Podiums.*Best.*Recent form.*Award/is
		);
		assert.match(body, /Season 0.*Starter League.*Bolt.*60.*Champion/is);
		assert.match(body, /Promotion and relegation history/i);
		assert.match(body, /Dash.*Promoted.*Academy League.*Starter League.*Season 0/is);
		assert.match(body, /League news.*Bolt wins Indigo Cup/is);
		assert.match(body, /Bolt won at Indigo Circuit.*Dash finished second/is);
		assert.match(body, /href="\/races\/race-recent"[^>]*>Indigo Cup/is);
		assert.match(body, /href="\/trainers"[^>]*>Misty/is);
		assert.match(body, /Next page/i);
		assert.doesNotMatch(body, /Send Test Notification|Avatar Tailwind|>Test</);
	} finally {
		await cleanup();
	}
});

test('dashboard renders useful loading, backend-error and section-level empty states', async () => {
	const { component, cleanup } = await serverDashboard();
	try {
		assert.match(render(component, { props: { loading: true } }).body, /Loading dashboard/i);
		assert.match(
			render(component, { props: { error: 'Could not load your dashboard. Please try again.' } })
				.body,
			/Could not load your dashboard.*Please try again/i
		);
		const empty = render(component, {
			props: {
				dashboard: {
					account: { balance: 0, change: 0, period: 'Last 24 hours' },
					wagering: {
						count: 0,
						open: 0,
						wins: 0,
						losses: 0,
						refunds: 0,
						totalStaked: 0,
						totalPayout: 0,
						profit: 0
					},
					trading: { trades: 0, buys: 0, sells: 0 },
					portfolio: {
						costBasis: 0,
						marketValue: 0,
						gain: 0,
						gainPercent: null,
						holdings: []
					},
					upcomingRaces: [],
					recentResults: [],
					watchedActivity: [],
					leagueTables: [],
					priorSeasons: [],
					racerMovementHistory: [],
					news: { items: [], page: 1, totalPages: 1, category: null }
				}
			}
		}).body;
		assert.match(empty, /No holdings yet/i);
		assert.match(empty, /No upcoming races are scheduled/i);
		assert.match(empty, /No recent results yet/i);
		assert.match(empty, /No watched-racer activity yet/i);
		assert.match(empty, /No active league tables are available/i);
		assert.match(empty, /No completed seasons yet/i);
		assert.match(empty, /No promotion or relegation history yet/i);
		assert.match(empty, /No league news has been published yet/i);
	} finally {
		await cleanup();
	}
});

test('dashboard page visibly loads while streamed live data is pending', async () => {
	const { component, cleanup } = await serverDashboardPage();
	try {
		const pendingDashboard = new Promise(() => undefined);
		const loadingBody = render(component, {
			props: { data: { dashboardState: pendingDashboard } }
		}).body;
		assert.match(loadingBody, /Loading dashboard/i);
		const readyBody = render(component, {
			props: {
				data: { dashboardState: { dashboard: populatedDashboard, error: null } }
			}
		}).body;
		assert.match(readyBody, /₽9,970/);
	} finally {
		await cleanup();
	}
});
