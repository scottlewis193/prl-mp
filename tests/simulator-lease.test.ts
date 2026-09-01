import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type PocketBase from 'pocketbase';
import { Container } from 'pixi.js';
import type { LeagueScheduleResult } from '../src/lib/leagueSchedule';
import { initializeTrackGraphics } from '../src/lib/trackGraphics';
import { createTrackRenderPlan } from '../src/lib/trackRendering';
import { simulateRacer } from '../src/lib/server/simulateRacer';
import type { RaceTrack, Racer } from '../src/lib/types';
import { NodePocketBase } from './support/node-pocketbase';
import {
	projectDirectory,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const serviceEmail = 'simulator-test@example.com';
const servicePassword = 'simulator-test-password';

let dataDirectory = '';
let server: ChildProcess;
let baseUrl = '';
let firstWorker: PocketBase;
let secondWorker: PocketBase;

async function claim(client: PocketBase, ownerId: string, ttlMs: number) {
	return client.send('/api/prl/simulator/lease', {
		method: 'POST',
		body: { ownerId, ttlMs }
	}) as Promise<{ acquired: boolean; token?: number }>;
}

async function commit(
	client: PocketBase,
	ownerId: string,
	token: number,
	racerUpdates: unknown[] = [],
	raceUpdate?: unknown
) {
	return client.send('/api/prl/simulator/commit', {
		method: 'POST',
		body: { ownerId, token, racerUpdates, raceUpdate }
	}) as Promise<{ committed: boolean }>;
}

async function settle(client: PocketBase, raceId: string) {
	return client.send('/api/prl/races/settle', {
		method: 'POST',
		body: { raceId }
	}) as Promise<{ settled: boolean }>;
}

async function rebuildTrainerCareers(client: PocketBase) {
	return client.send('/api/prl/trainers/rebuild-careers', {
		method: 'POST'
	}) as Promise<{ rebuilt: number }>;
}

async function reconcileSchedule(
	client: PocketBase,
	now: string,
	overrides: Record<string, unknown> = {}
) {
	return client.send('/api/prl/schedule/reconcile', {
		method: 'POST',
		body: {
			now,
			futureEventCount: 2,
			eventIntervalMs: 60 * 60 * 1000,
			scheduleOffsetMs: 0,
			countdownMs: 5 * 60 * 1000,
			totalLaps: 3,
			...overrides
		}
	}) as Promise<LeagueScheduleResult>;
}

async function resetScheduleFixture(client: PocketBase): Promise<void> {
	const events = await client.collection('events').getFullList();
	await Promise.all(events.map((event) => client.collection('events').delete(event.id)));

	const races = await client.collection('races').getFullList();
	await Promise.all(
		races
			.filter((race) => race.id !== 'prlseedrace0001')
			.map((race) => client.collection('races').delete(race.id))
	);

	const racers = await client.collection('racers').getFullList({ sort: 'id' });
	await Promise.all(
		racers.map((racer, index) =>
			client.collection('racers').update(racer.id, {
				race: null,
				status: { ...racer.status, injured: index >= 8, retired: false }
			})
		)
	);
	await client.collection('races').update('prlseedrace0001', {
		status: 'settled',
		league: null
	});
}

async function makeEveryRacerEligible(client: PocketBase): Promise<void> {
	const racers = await client.collection('racers').getFullList({ sort: 'id' });
	await Promise.all(
		racers.map((racer, index) =>
			client.collection('racers').update(racer.id, {
				status: { ...racer.status, injured: index >= 8, retired: false }
			})
		)
	);
}

before(async () => {
	dataDirectory = await mkdtemp(join(tmpdir(), 'prl-simulator-test-'));
	const port = 18_000 + Math.floor(Math.random() * 10_000);
	baseUrl = `http://127.0.0.1:${port}`;
	server = await startPocketBase({
		baseUrl,
		port,
		dataDirectory,
		migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
		serviceEmail,
		servicePassword
	});
	firstWorker = new NodePocketBase(baseUrl);
	secondWorker = new NodePocketBase(baseUrl);
	firstWorker.autoCancellation(false);
	secondWorker.autoCancellation(false);
	await Promise.all([
		firstWorker.collection('users').authWithPassword(serviceEmail, servicePassword),
		secondWorker.collection('users').authWithPassword(serviceEmail, servicePassword)
	]);
});

after(async () => {
	if (server) await stopPocketBase(server);
	await rm(dataDirectory, { recursive: true, force: true });
});

test('migrates five distinct tracks through the shared simulation and rendering contracts', async () => {
	const tracks = await firstWorker.collection('racetracks').getFullList({ sort: 'id' });
	assert.equal(tracks.length, 5);
	assert.deepEqual(tracks.map((track) => track.name).sort(), [
		'Alpine Switchback',
		'Coastal Loop',
		'Default Track',
		'Forest Chicane',
		'Red Canyon Ring'
	]);
	assert.equal(new Set(tracks.map((track) => JSON.stringify(track.checkpoints))).size, 5);
	assert.equal(
		new Set(
			tracks.map((track) =>
				JSON.stringify({
					surface: track.surface,
					corneringDemand: track.corneringDemand,
					speedBias: track.speedBias,
					risk: track.risk,
					hazards: track.hazards
				})
			)
		).size,
		5
	);
	for (const track of tracks) {
		assert.equal(track.length > 0, true);
		assert.equal(track.width > 0, true);
		assert.equal(typeof track.surface, 'string');
		assert.equal(Array.isArray(track.hazards), true);
		assert.equal(track.corneringDemand >= 0 && track.corneringDemand <= 1, true);
		assert.equal(track.speedBias >= -1 && track.speedBias <= 1, true);
		assert.equal(track.risk >= 0 && track.risk <= 1, true);
		assert.deepEqual(track.compatibleFormats, ['circuit']);
		const plan = createTrackRenderPlan(track as never);
		assert.equal(plan.checkpoints.length >= 2, true);
		assert.equal(plan.tileCount > 0, true);
	}
	const sourceRacer = await firstWorker.collection('racers').getOne('prlseedracer001', {
		expand: 'pokemon'
	});
	for (const track of tracks) {
		const plan = createTrackRenderPlan(track as never);
		const racer = JSON.parse(JSON.stringify(sourceRacer)) as Racer;
		racer.currentRace.lastUpdatedAt = new Date(0).toISOString();
		const simulated = simulateRacer(racer, track as unknown as RaceTrack, 1_000, 1);
		assert.equal(Number.isFinite(simulated.x) && Number.isFinite(simulated.y), true);
		assert.equal(simulated.trackContext.trackId, track.id);
		assert.equal(simulated.trackContext.incident.trackRisk, track.risk);
		assert.equal(simulated.trackContext.incident.corneringDemand, track.corneringDemand);
		assert.deepEqual(simulated.trackContext.incident.hazards, track.hazards);
		if (track.id === 'prlcoasttrack01') {
			const viewerTrack = new Container({ label: 'static-track' });
			const graphics = initializeTrackGraphics(viewerTrack, plan.geometry);
			const bounds = graphics.getBounds();
			assert.equal(viewerTrack.getChildByLabel('track-characteristics'), graphics);
			assert.deepEqual(
				{ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
				{ x: 8, y: 8, width: 176, height: 112 }
			);
		}
	}
	const originalRace = await firstWorker.collection('races').getOne('prlseedrace0001');
	assert.equal(originalRace.racetrack, '175hl67e5pvjjib');
	assert.equal(originalRace.format, 'circuit');
});

test('excludes concurrent owners and permits recovery after the lease expires', async () => {
	const [firstClaim, secondClaim] = await Promise.all([
		claim(firstWorker, 'worker-one', 25),
		claim(secondWorker, 'worker-two', 25)
	]);

	assert.equal([firstClaim.acquired, secondClaim.acquired].filter(Boolean).length, 1);

	await new Promise((resolveWait) => setTimeout(resolveWait, 50));
	const recoveredClaim = await claim(secondWorker, 'replacement-worker', 5_000);

	assert.equal(recoveredClaim.acquired, true);
	assert.notEqual(recoveredClaim.token, firstClaim.token ?? secondClaim.token);
	const racer = await secondWorker.collection('racers').getOne('prlseedracer001', {
		expand: 'pokemon'
	});
	const coastalTrack = await secondWorker.collection('racetracks').getOne('prlcoasttrack01');
	const coastalSimulation = simulateRacer(
		JSON.parse(JSON.stringify(racer)) as Racer,
		coastalTrack as unknown as RaceTrack,
		1_000,
		1
	);
	const staleUpdate = {
		id: racer.id,
		currentRace: { ...racer.currentRace, distanceFromCheckpoint: 111 },
		positioning: { ...racer.positioning, x: 111 },
		stats: racer.stats
	};
	assert.equal(
		(
			await commit(
				firstWorker,
				firstClaim.acquired ? 'worker-one' : 'worker-two',
				(firstClaim.token ?? secondClaim.token) as number,
				[staleUpdate]
			)
		).committed,
		false
	);
	const currentUpdate = {
		...staleUpdate,
		currentRace: {
			...racer.currentRace,
			distanceFromCheckpoint: 222,
			trackContext: coastalSimulation.trackContext
		},
		positioning: { ...racer.positioning, x: 222 }
	};
	assert.equal(
		(
			await commit(secondWorker, 'replacement-worker', recoveredClaim.token as number, [
				currentUpdate
			])
		).committed,
		true
	);
	const persistedRacer = await secondWorker.collection('racers').getOne(racer.id);
	assert.equal(persistedRacer.currentRace.distanceFromCheckpoint, 222);
	assert.deepEqual(persistedRacer.currentRace.trackContext, coastalSimulation.trackContext);
	assert.equal(persistedRacer.positioning.x, 222);
});

test('rolls back every settlement effect when the durable event write fails', async () => {
	const raceId = 'prlseedrace0001';
	const racers = await firstWorker.collection('racers').getFullList({
		filter: `race = "${raceId}"`,
		sort: 'id'
	});
	await Promise.all(
		racers.map((racer, index) => {
			const finishedAt = new Date(Date.UTC(2026, 7, 14, 11, 59, index)).toISOString();
			return firstWorker.collection('racers').update(racer.id, {
				currentRace: { ...racer.currentRace, finished: true, finishedAt }
			});
		})
	);
	await firstWorker.collection('races').update(raceId, { status: 'finished' });
	const blockingEvent = await firstWorker.collection('events').create({
		type: 'RaceSettled',
		idempotencyKey: `race-settled:${raceId}`,
		occurredAt: '2026-08-14T12:00:00.000Z',
		raceIds: [raceId],
		started: true,
		finished: true,
		facts: { testFixture: 'force the unique event write to fail' }
	});
	const before = JSON.stringify({
		race: await firstWorker.collection('races').getOne(raceId),
		racers: await firstWorker.collection('racers').getFullList({ sort: 'id' }),
		trainers: await firstWorker.collection('trainers').getFullList({ sort: 'id' }),
		trainerResults: await firstWorker.collection('trainerRaceResults').getFullList({ sort: 'id' }),
		events: await firstWorker.collection('events').getFullList({ sort: 'id' })
	});

	await assert.rejects(
		() => settle(firstWorker, raceId),
		(error: { status?: number }) => error.status === 400
	);

	assert.equal(
		JSON.stringify({
			race: await firstWorker.collection('races').getOne(raceId),
			racers: await firstWorker.collection('racers').getFullList({ sort: 'id' }),
			trainers: await firstWorker.collection('trainers').getFullList({ sort: 'id' }),
			trainerResults: await firstWorker
				.collection('trainerRaceResults')
				.getFullList({ sort: 'id' }),
			events: await firstWorker.collection('events').getFullList({ sort: 'id' })
		}),
		before
	);
	await firstWorker.collection('events').delete(blockingEvent.id);
});

test('settles a finished race atomically and remains unchanged when settlement is retried', async () => {
	const raceId = 'prlseedrace0001';
	const finishedAt = '2026-08-14T12:00:08.000Z';
	const racers = await firstWorker.collection('racers').getFullList({
		filter: `race = "${raceId}"`,
		sort: 'id'
	});
	const rosterMovedRacer = racers[0];
	const explicitlyUntrainedRacer = racers[1];
	const entryTrainerId = rosterMovedRacer.currentRace.trainerAtEntry.trainerId as string;
	const untrainedOriginalTrainerId = explicitlyUntrainedRacer.trainer as string;
	await firstWorker.collection('racers').update(rosterMovedRacer.id, {
		trainer: racers[2].trainer
	});
	await firstWorker.collection('racers').update(explicitlyUntrainedRacer.id, {
		trainer: null,
		currentRace: {
			...explicitlyUntrainedRacer.currentRace,
			trainerAtEntry: { status: 'untrained' }
		}
	});
	explicitlyUntrainedRacer.currentRace.trainerAtEntry = { status: 'untrained' };
	const balanceBeforeWagers = firstWorker.authStore.record?.balance as number;
	const bettingCutoff = new Date(Date.now() + 60_000).toISOString();
	await firstWorker.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: bettingCutoff,
			winnerSelections: [
				{ racerId: racers[0].id, odds: 3 },
				{ racerId: racers.at(-1)?.id, odds: 2.5 }
			]
		}
	});
	await firstWorker.send('/api/prl/wagers/place', {
		method: 'POST',
		body: {
			raceId,
			market: 'winner',
			selection: racers.at(-1)?.id,
			stake: 20,
			idempotencyKey: 'settlement-winner'
		}
	});
	await firstWorker.send('/api/prl/wagers/place', {
		method: 'POST',
		body: {
			raceId,
			market: 'winner',
			selection: racers[0].id,
			stake: 10,
			idempotencyKey: 'settlement-loser'
		}
	});
	await Promise.all(
		racers.map((racer, index) => {
			const crossingTime = new Date(Date.parse(finishedAt) - (index + 1) * 1000).toISOString();
			return firstWorker.collection('racers').update(racer.id, {
				currentRace: {
					...racer.currentRace,
					finished: true,
					lastUpdatedAt: crossingTime,
					...(index === racers.length - 1 ? {} : { finishedAt: crossingTime })
				}
			});
		})
	);
	await firstWorker.collection('races').update(raceId, {
		status: 'finished',
		winner: '',
		endTime: finishedAt
	});
	const finishedRacers = await firstWorker.collection('racers').getFullList({
		filter: `race = "${raceId}"`,
		sort: 'id'
	});
	assert.equal(
		finishedRacers.every(
			(racer) => racer.currentRace.finished && typeof racer.currentRace.lastUpdatedAt === 'string'
		),
		true
	);
	await firstWorker.collection('leagues').update('prlseeddemo0001', {
		prizeMoneyScaling: 100
	});

	assert.deepEqual(await settle(firstWorker, raceId), { settled: true });

	const settledRace = await firstWorker.collection('races').getOne(raceId);
	const settledRacers = await firstWorker.collection('racers').getFullList({ sort: 'id' });
	assert.equal(settledRace.status, 'settled');
	assert.equal(settledRace.winner, racers.at(-1)?.id);
	assert.deepEqual(
		settledRace.finishingOrder,
		[...racers].reverse().map((racer) => racer.id)
	);
	assert.equal(
		settledRace.endTime,
		new Date(Date.parse(finishedAt) - 1000).toISOString().replace('T', ' ')
	);
	assert.equal(
		settledRacers.every((racer) => racer.race === ''),
		true
	);
	assert.deepEqual(
		settledRace.awardedPrizes,
		[...racers].reverse().map((racer, index) => ({
			racerId: racer.id,
			position: index + 1,
			amount: 8 - index
		}))
	);
	const settlementEvents = await firstWorker.collection('events').getFullList({
		filter: `idempotencyKey = "race-settled:${raceId}"`
	});
	assert.equal(settlementEvents.length, 1);
	const newsItems = await firstWorker.collection('news').getFullList({
		filter: `sourceEvent = "${settlementEvents[0].id}"`
	});
	assert.equal(newsItems.length, 1);
	assert.equal(newsItems[0].race, raceId);
	assert.deepEqual(
		newsItems[0].racers,
		[...racers].reverse().map((racer) => racer.id)
	);
	assert.equal(newsItems[0].track, settledRace.racetrack);
	assert.equal(newsItems[0].league, settledRace.league);
	assert.equal(newsItems[0].category, 'race_result');
	assert.equal(newsItems[0].importance, 70);
	assert.equal(newsItems[0].sourceEvent, settlementEvents[0].id);
	assert.match(newsItems[0].headline, new RegExp(racers.at(-1)?.name as string));
	assert.match(newsItems[0].summary, new RegExp(settledRace.name));
	assert.match(newsItems[0].summary, /market.*10\.00.*10\.80/i);
	assert.match(newsItems[0].summary, /career record.*wins from.*starts/i);
	const settledParticipants = settledRacers.filter((settledRacer) =>
		racers.some((racer) => racer.id === settledRacer.id)
	);
	assert.deepEqual(
		settledParticipants.map((racer) => racer.financials.currentSharePrice),
		[9.2, 9.43, 9.66, 9.89, 10.11, 10.34, 10.57, 10.8]
	);
	for (const racer of settledParticipants) {
		const pricePoint = racer.financials.priceHistory.at(-1);
		assert.equal(pricePoint.previousPrice, 10);
		assert.equal(pricePoint.price, racer.financials.currentSharePrice);
		assert.equal(Date.parse(pricePoint.timestamp), Date.parse(settledRace.endTime));
		assert.equal(pricePoint.reason.type, 'race_result');
		assert.equal(pricePoint.reason.raceId, raceId);
		assert.equal(pricePoint.rulesVersion, 'race-valuation-v1');
		assert.equal(pricePoint.sourceEvent, settlementEvents[0].id);
	}
	assert.deepEqual(
		settlementEvents[0].facts.priceMovements.map(
			(movement: { racerId: string; previousPrice: number; price: number }) => ({
				racerId: movement.racerId,
				previousPrice: movement.previousPrice,
				price: movement.price
			})
		),
		[...racers].reverse().map((racer, index) => ({
			racerId: racer.id,
			previousPrice: 10,
			price: [10.8, 10.57, 10.34, 10.11, 9.89, 9.66, 9.43, 9.2][index]
		}))
	);
	assert.equal(
		(await secondWorker.collection('racers').getOne(racers.at(-1)?.id as string)).financials
			.currentSharePrice,
		10.8
	);
	const [newsLeague, newsTrack, ...newsTrainers] = await Promise.all([
		firstWorker.collection('leagues').getOne(settledRace.league),
		firstWorker.collection('racetracks').getOne(settledRace.racetrack),
		...newsItems[0].trainers.map((trainerId: string) =>
			firstWorker.collection('trainers').getOne(trainerId)
		)
	]);
	assert.deepEqual(settlementEvents[0].facts.newsContext, {
		race: { id: raceId, name: settledRace.name },
		winner: {
			id: racers.at(-1)?.id,
			name: racers.at(-1)?.name
		},
		finishers: [...racers].reverse().map((racer) => ({ id: racer.id, name: racer.name })),
		trainers: newsTrainers.map((trainer) => ({ id: trainer.id, name: trainer.name })),
		league: { id: newsLeague.id, name: newsLeague.name },
		track: { id: newsTrack.id, name: newsTrack.name },
		winnerCareer: { wins: 1, starts: 1 },
		notableTactics: []
	});
	assert.deepEqual(
		{
			raceId: settlementEvents[0].facts.raceId,
			winnerId: settlementEvents[0].facts.winnerId,
			finishingOrder: settlementEvents[0].facts.finishingOrder,
			awardedPrizes: settlementEvents[0].facts.awardedPrizes
		},
		{
			raceId,
			winnerId: racers.at(-1)?.id,
			finishingOrder: [...racers].reverse().map((racer) => racer.id),
			awardedPrizes: settledRace.awardedPrizes
		}
	);
	const trainerResults = await firstWorker.collection('trainerRaceResults').getFullList({
		filter: `race = "${raceId}"`,
		sort: 'position'
	});
	assert.deepEqual(
		new Set(newsItems[0].trainers),
		new Set(trainerResults.map((result) => result.trainer).filter(Boolean))
	);
	assert.equal(trainerResults.length, racers.length);
	const rosterMovedResult = trainerResults.find((result) => result.racer === rosterMovedRacer.id);
	assert.equal(rosterMovedResult?.trainer, entryTrainerId);
	assert.equal(rosterMovedResult?.attributionStatus, 'attributed');
	const untrainedResult = trainerResults.find(
		(result) => result.racer === explicitlyUntrainedRacer.id
	);
	assert.equal(untrainedResult?.trainer, '');
	assert.equal(untrainedResult?.attributionStatus, 'untrained');
	assert.deepEqual(
		settlementEvents[0].facts.trainerResults.map(
			(result: {
				racerId: string;
				trainerId: string | null;
				attributionStatus: string;
				position: number;
				earnings: number;
			}) => ({
				racerId: result.racerId,
				trainerId: result.trainerId,
				attributionStatus: result.attributionStatus,
				position: result.position,
				earnings: result.earnings
			})
		),
		trainerResults.map((result) => ({
			racerId: result.racer,
			trainerId: result.trainer || null,
			attributionStatus: result.attributionStatus,
			position: result.position,
			earnings: result.earnings
		}))
	);
	const trainerCareers = await firstWorker.collection('trainers').getFullList();
	assert.equal(
		trainerCareers.reduce((starts, trainer) => starts + trainer.career.starts, 0),
		racers.length - 1
	);
	assert.equal(
		trainerCareers.reduce((earnings, trainer) => earnings + trainer.career.earnings, 0),
		trainerResults
			.filter((result) => result.trainer)
			.reduce((earnings, result) => earnings + result.earnings, 0)
	);
	const settledWagers = await firstWorker.collection('wagers').getFullList({ sort: 'selection' });
	assert.deepEqual(
		settledWagers.map((wager) => ({
			selection: wager.selection,
			status: wager.status,
			payout: wager.payout
		})),
		[
			{ selection: racers[0].id, status: 'lost', payout: 0 },
			{ selection: racers.at(-1)?.id, status: 'won', payout: 50 }
		]
	);
	const refreshedAfterPayout = await firstWorker.collection('users').authRefresh();
	assert.equal(refreshedAfterPayout.record.balance, balanceBeforeWagers + 20);
	const payoutEntries = await firstWorker.collection('accountLedger').getFullList({
		filter: `wager = "${settledWagers.find((wager) => wager.status === 'won')?.id}" && type = "wager_payout"`
	});
	assert.deepEqual(
		payoutEntries.map((entry) => ({
			balanceDelta: entry.balanceDelta,
			reason: entry.reason,
			sourceKey: entry.sourceKey
		})),
		[
			{
				balanceDelta: 50,
				reason: 'winning_wager_paid',
				sourceKey: `wager:${settledWagers.find((wager) => wager.status === 'won')?.id}:payout`
			}
		]
	);
	assert.deepEqual(
		settledParticipants.map((racer) => ({
			position: racer.raceHistory.races.at(-1)?.position,
			prizeMoney: racer.raceHistory.races.at(-1)?.prizeMoney,
			totalRaces: racer.raceHistory.totalRaces,
			wins: racer.raceHistory.wins,
			ranking: racer.stats.ranking,
			totalEarnings: racer.financials.totalEarnings,
			averageFinishPosition: racer.raceHistory.averageFinishPosition
		})),
		Array.from({ length: racers.length }, (_, index) => ({
			position: racers.length - index,
			prizeMoney: index + 1,
			totalRaces: 1,
			wins: index === racers.length - 1 ? 1 : 0,
			ranking: index + 1,
			totalEarnings: index + 1,
			averageFinishPosition: racers.length - index
		}))
	);

	const beforeRetry = JSON.stringify({
		racers: settledRacers,
		wagers: settledWagers,
		events: settlementEvents,
		news: newsItems,
		trainerResults,
		trainerCareers,
		balance: refreshedAfterPayout.record.balance
	});
	assert.deepEqual(await settle(secondWorker, raceId), { settled: false });
	assert.equal(
		JSON.stringify({
			racers: await secondWorker.collection('racers').getFullList({ sort: 'id' }),
			wagers: await secondWorker.collection('wagers').getFullList({ sort: 'selection' }),
			events: await secondWorker.collection('events').getFullList({
				filter: `idempotencyKey = "race-settled:${raceId}"`
			}),
			news: await secondWorker.collection('news').getFullList({
				filter: `sourceEvent = "${settlementEvents[0].id}"`
			}),
			trainerResults: await secondWorker.collection('trainerRaceResults').getFullList({
				filter: `race = "${raceId}"`,
				sort: 'position'
			}),
			trainerCareers: await secondWorker.collection('trainers').getFullList(),
			balance: (await secondWorker.collection('users').authRefresh()).record.balance
		}),
		beforeRetry
	);
	const cancellationLease = await claim(secondWorker, 'replacement-worker', 5_000);
	assert.equal(cancellationLease.acquired, true);
	const beforeRejectedCancellation = JSON.stringify({
		race: await secondWorker.collection('races').getOne(raceId),
		wagers: await secondWorker.collection('wagers').getFullList({ sort: 'id' }),
		ledger: await secondWorker.collection('accountLedger').getFullList({ sort: 'id' }),
		balance: (await secondWorker.collection('users').authRefresh()).record.balance
	});
	await assert.rejects(
		() =>
			secondWorker.send('/api/prl/races/void', {
				method: 'POST',
				body: { raceId }
			}),
		/settled races cannot be voided/i
	);
	await assert.rejects(
		() =>
			commit(secondWorker, 'replacement-worker', cancellationLease.token as number, [], {
				id: raceId,
				status: 'cancelled',
				endTime: '2026-08-14T12:01:00.000Z'
			}),
		/settled races cannot be voided/i
	);
	await assert.rejects(
		() =>
			commit(secondWorker, 'replacement-worker', cancellationLease.token as number, [], {
				id: raceId,
				status: 'running',
				winner: racers[0].id,
				endTime: '2026-08-14T12:02:00.000Z',
				finishingOrder: []
			}),
		/terminal races cannot be mutated/i
	);
	assert.equal(
		JSON.stringify({
			race: await secondWorker.collection('races').getOne(raceId),
			wagers: await secondWorker.collection('wagers').getFullList({ sort: 'id' }),
			ledger: await secondWorker.collection('accountLedger').getFullList({ sort: 'id' }),
			balance: (await secondWorker.collection('users').authRefresh()).record.balance
		}),
		beforeRejectedCancellation
	);
	const projectedTrainer = trainerCareers.find((trainer) => trainer.career.starts === 1);
	assert.ok(projectedTrainer);
	await firstWorker.collection('trainers').update(projectedTrainer.id, {
		career: { starts: 999, wins: 999, podiums: 999, earnings: 999, championships: 999 }
	});
	await firstWorker.collection('trainerChampionships').create({
		trainer: projectedTrainer.id,
		championshipKey: 'test-season-1',
		name: 'Test Season Championship',
		occurredAt: '2026-08-15T12:00:00.000Z'
	});
	assert.deepEqual(await rebuildTrainerCareers(firstWorker), { rebuilt: trainerCareers.length });
	assert.deepEqual((await firstWorker.collection('trainers').getOne(projectedTrainer.id)).career, {
		...projectedTrainer.career,
		championships: 1
	});
	await firstWorker.collection('racers').update(rosterMovedRacer.id, {
		trainer: entryTrainerId
	});
	await firstWorker.collection('racers').update(explicitlyUntrainedRacer.id, {
		trainer: untrainedOriginalTrainerId
	});
	await firstWorker.collection('leagues').update('prlseeddemo0001', { prizeMoneyScaling: 1 });
});

test('cancelled and invalid races award no prizes or career progression', async () => {
	const raceId = 'prlseedrace0001';
	const racer = await firstWorker.collection('racers').getOne('prlseedracer001');
	await firstWorker.collection('racers').update(racer.id, {
		race: raceId,
		currentRace: { ...racer.currentRace, finished: false, finishedAt: '' }
	});
	await firstWorker.collection('races').update(raceId, {
		status: 'cancelled',
		awardedPrizes: []
	});
	const beforeCancelled = await firstWorker.collection('racers').getOne(racer.id);

	await assert.rejects(() => settle(firstWorker, raceId), /only finished races/i);
	assert.deepEqual(await firstWorker.collection('racers').getOne(racer.id), beforeCancelled);

	await firstWorker.collection('races').update(raceId, { status: 'finished' });
	const beforeInvalid = await firstWorker.collection('racers').getOne(racer.id);
	await assert.rejects(
		() => settle(firstWorker, raceId),
		(error: { status?: number }) => error.status === 400
	);
	assert.deepEqual(await firstWorker.collection('racers').getOne(racer.id), beforeInvalid);
	assert.deepEqual((await firstWorker.collection('races').getOne(raceId)).awardedPrizes, []);
	assert.equal(
		(
			await firstWorker.collection('events').getFullList({
				filter: `idempotencyKey = "race-settled:${raceId}"`
			})
		).length,
		1
	);
});

test('a cancelled race refunds each reserved stake exactly once', async () => {
	await resetScheduleFixture(firstWorker);
	await makeEveryRacerEligible(firstWorker);
	await firstWorker
		.collection('leagues')
		.update('prlseeddemo0001', { maxPlayers: 4, prizeMoneyScaling: 1 });
	const now = new Date();
	const startsAt = new Date(now.getTime() + 60_000).toISOString();
	await firstWorker.collection('races').update('prlseedrace0001', {
		status: 'pending',
		league: 'prlseeddemo0001',
		startTime: startsAt
	});
	await firstWorker.collection('events').create({
		type: 'DailyLeagueRaces',
		scheduleKey: `void-test:${now.getTime()}`,
		startTime: startsAt,
		raceIds: ['prlseedrace0001'],
		started: false,
		finished: false
	});
	await reconcileSchedule(firstWorker, now.toISOString(), { futureEventCount: 1 });
	const race = await firstWorker.collection('races').getOne('prlseedrace0001');
	const assigned = await firstWorker.collection('racers').getFullList({
		filter: `race = "${race.id}"`,
		sort: 'id'
	});
	const balanceBefore = (await firstWorker.collection('users').authRefresh()).record.balance;
	const placed = (await firstWorker.send('/api/prl/wagers/place', {
		method: 'POST',
		body: {
			raceId: race.id,
			market: 'winner',
			selection: assigned[0].id,
			stake: 25,
			idempotencyKey: 'void-refund'
		}
	})) as { id: string };
	const allRacers = await firstWorker.collection('racers').getFullList();
	await Promise.all(
		allRacers.map((racer) =>
			firstWorker.collection('racers').update(racer.id, {
				race: null,
				status: { ...racer.status, injured: true }
			})
		)
	);

	const lease = await claim(secondWorker, 'replacement-worker', 5_000);
	assert.equal(lease.acquired, true);
	assert.equal(
		(
			await commit(secondWorker, 'replacement-worker', lease.token as number, [], {
				id: race.id,
				status: 'cancelled',
				endTime: race.startTime
			})
		).committed,
		true
	);
	const refunded = await firstWorker.collection('wagers').getOne(placed.id);
	assert.deepEqual(
		{ status: refunded.status, payout: refunded.payout },
		{ status: 'refunded', payout: 25 }
	);
	assert.equal((await firstWorker.collection('users').authRefresh()).record.balance, balanceBefore);
	const refundEntriesBeforeRetry = await firstWorker.collection('accountLedger').getFullList({
		filter: `wager = "${refunded.id}" && type = "wager_refund"`
	});
	assert.equal(refundEntriesBeforeRetry.length, 1);

	assert.equal(
		(
			await commit(secondWorker, 'replacement-worker', lease.token as number, [], {
				id: race.id,
				status: 'cancelled',
				endTime: race.startTime
			})
		).committed,
		true
	);
	assert.equal(
		(
			await secondWorker.collection('accountLedger').getFullList({
				filter: `wager = "${refunded.id}" && type = "wager_refund"`
			})
		).length,
		1
	);
	assert.equal(
		(await secondWorker.collection('users').authRefresh()).record.balance,
		balanceBefore
	);
	const cancelledSnapshot = JSON.stringify({
		race: await secondWorker.collection('races').getOne(race.id),
		wager: await secondWorker.collection('wagers').getOne(refunded.id),
		ledger: await secondWorker.collection('accountLedger').getFullList({ sort: 'id' }),
		balance: (await secondWorker.collection('users').authRefresh()).record.balance
	});
	await assert.rejects(
		() =>
			commit(secondWorker, 'replacement-worker', lease.token as number, [], {
				id: race.id,
				status: 'pending',
				winner: assigned[0].id,
				endTime: new Date(Date.parse(race.startTime) + 60_000).toISOString(),
				finishingOrder: [assigned[0].id]
			}),
		/terminal races cannot be mutated/i
	);
	assert.equal(
		JSON.stringify({
			race: await secondWorker.collection('races').getOne(race.id),
			wager: await secondWorker.collection('wagers').getOne(refunded.id),
			ledger: await secondWorker.collection('accountLedger').getFullList({ sort: 'id' }),
			balance: (await secondWorker.collection('users').authRefresh()).record.balance
		}),
		cancelledSnapshot
	);
	await makeEveryRacerEligible(firstWorker);
});

test('maintains the configured event pipeline without duplicate or overlapping assignments', async () => {
	await resetScheduleFixture(firstWorker);
	await firstWorker
		.collection('leagues')
		.update('prlseeddemo0001', { maxPlayers: 4, prizeMoneyScaling: 1 });
	const ineligibleRacer = await firstWorker.collection('racers').getOne('prlseedracer001');
	await firstWorker.collection('racers').update(ineligibleRacer.id, {
		status: { ...ineligibleRacer.status, injured: true }
	});
	const entryUntrainedRacer = await firstWorker.collection('racers').getOne('prlseedracer002');
	const entryUntrainedOriginalTrainer = entryUntrainedRacer.trainer;
	await firstWorker.collection('racers').update(entryUntrainedRacer.id, { trainer: null });

	const firstRun = await reconcileSchedule(firstWorker, '2026-08-14T12:05:00.000Z', {
		schedulingSeed: 'B'
	});
	assert.deepEqual(firstRun, {
		createdEvents: 2,
		createdRaces: 10,
		assignedRacers: 6,
		transitionedRaces: 0
	});

	const secondRun = await reconcileSchedule(secondWorker, '2026-08-14T12:05:00.000Z');
	assert.deepEqual(secondRun, {
		createdEvents: 0,
		createdRaces: 0,
		assignedRacers: 0,
		transitionedRaces: 0
	});

	const events = await firstWorker.collection('events').getFullList({ sort: 'startTime' });
	const races = await firstWorker.collection('races').getFullList({
		filter: 'league = "prlseeddemo0001"',
		sort: 'startTime'
	});
	const racers = await firstWorker.collection('racers').getFullList();
	assert.equal(racers.find((racer) => racer.id === entryUntrainedRacer.id)?.race, '');
	await firstWorker.collection('racers').update(entryUntrainedRacer.id, {
		trainer: entryUntrainedOriginalTrainer
	});

	assert.equal(events.length, 2);
	assert.equal(new Set(events.map((event) => event.scheduleKey)).size, 2);
	assert.deepEqual(
		events.map((event) => new Date(event.startTime).toISOString()),
		['2026-08-14T13:00:00.000Z', '2026-08-14T14:00:00.000Z']
	);
	const scheduledRotation = await Promise.all(
		events
			.flatMap((event) => event.raceIds)
			.map((raceId) => firstWorker.collection('races').getOne(raceId))
	);
	assert.deepEqual(
		scheduledRotation.map((race) => race.racetrack),
		[
			'175hl67e5pvjjib',
			'prlalpinetrack1',
			'prlcanyontrack1',
			'prlcoasttrack01',
			'prlforesttrack1',
			'prlalpinetrack1',
			'prlcanyontrack1',
			'prlcoasttrack01',
			'prlforesttrack1',
			'175hl67e5pvjjib'
		]
	);
	assert.equal(
		scheduledRotation.some(
			(race, index, rotation) => race.racetrack === rotation[index - 1]?.racetrack
		),
		false
	);
	assert.equal(races.length, 2);
	assert.equal(new Set(races.map((race) => race.racetrack)).size, 2);
	assert.equal(
		races.every((race) => race.format === 'circuit'),
		true
	);
	assert.equal(
		races.every(
			(race) =>
				new Date(race.bettingCutoff).toISOString() === new Date(race.startTime).toISOString() &&
				race.markets?.winnerType === 'winner' &&
				race.markets?.winnerName === 'Race winner' &&
				new Date(race.markets?.winnerCutoff).toISOString() ===
					new Date(race.startTime).toISOString() &&
				race.markets?.winnerSelections?.length >= 2 &&
				race.markets.winnerSelections.every(
					(selection: { racerId: string; odds: number }) =>
						selection.racerId && selection.odds >= 1.01
				)
		),
		true
	);
	assert.equal(
		races.every((race) => race.league === 'prlseeddemo0001'),
		true
	);
	assert.deepEqual(
		races.map((race) => race.prizeCurve),
		[
			[4, 3, 2, 1],
			[4, 3, 2, 1]
		]
	);
	assert.deepEqual(
		races.map((race) => racers.filter((racer) => racer.race === race.id).length),
		[4, 2]
	);
	assert.equal(
		races.every((race) => race.prizeCurve.length === 4),
		true
	);
	assert.equal(
		racers
			.filter((racer) => !racer.status.injured && !racer.status.retired && racer.trainer)
			.every((racer) => races.some((race) => race.id === racer.race)),
		true
	);
	assert.equal(racers.find((racer) => racer.id === ineligibleRacer.id)?.race, '');
});

test('reconciles countdown and running transitions at scheduled times after a restart', async () => {
	await resetScheduleFixture(firstWorker);
	await makeEveryRacerEligible(firstWorker);
	await firstWorker
		.collection('leagues')
		.update('prlseeddemo0001', { maxPlayers: 8, prizeMoneyScaling: 1 });
	await reconcileSchedule(firstWorker, '2026-08-14T12:00:00.000Z', { futureEventCount: 1 });

	const [scheduledRace] = await firstWorker.collection('races').getFullList({
		filter: 'league = "prlseeddemo0001"'
	});
	assert.equal(scheduledRace.status, 'pending');

	const countdownRun = await reconcileSchedule(secondWorker, '2026-08-14T12:55:00.000Z', {
		futureEventCount: 1
	});
	assert.equal(countdownRun.transitionedRaces, 5);
	assert.equal(
		(await firstWorker.collection('races').getOne(scheduledRace.id)).status,
		'countdown'
	);

	const startRun = await reconcileSchedule(firstWorker, '2026-08-14T13:00:00.000Z', {
		futureEventCount: 1
	});
	assert.equal(startRun.transitionedRaces, 5);
	const runningRace = await firstWorker.collection('races').getOne(scheduledRace.id);
	const event = await firstWorker
		.collection('events')
		.getFirstListItem(`raceIds ?~ "${scheduledRace.id}"`);
	assert.equal(runningRace.status, 'running');
	assert.equal(new Date(runningRace.startTime).toISOString(), '2026-08-14T13:00:00.000Z');
	assert.equal(event.started, true);
	const runningEntrants = await firstWorker.collection('racers').getFullList({
		filter: `race = "${scheduledRace.id}"`
	});
	assert.equal(
		runningEntrants.every(
			(racer) =>
				racer.currentRace.trainerAtEntry.status === 'attributed' &&
				racer.currentRace.trainerAtEntry.trainerId === racer.trainer
		),
		true
	);

	const restartRun = await reconcileSchedule(secondWorker, '2026-08-14T13:01:00.000Z', {
		futureEventCount: 1
	});
	assert.equal(restartRun.transitionedRaces, 0);
	assert.equal((await secondWorker.collection('races').getOne(scheduledRace.id)).status, 'running');
});

test('starts a missed pending schedule directly and remains idempotent after restart', async () => {
	await resetScheduleFixture(firstWorker);
	await reconcileSchedule(firstWorker, '2026-08-14T12:00:00.000Z', { futureEventCount: 1 });
	const [scheduledRace] = await firstWorker.collection('races').getFullList({
		filter: 'league = "prlseeddemo0001"'
	});

	const recovered = await reconcileSchedule(secondWorker, '2026-08-14T13:01:00.000Z', {
		futureEventCount: 1
	});
	assert.equal(recovered.transitionedRaces, 5);
	assert.equal((await firstWorker.collection('races').getOne(scheduledRace.id)).status, 'running');

	const retried = await reconcileSchedule(firstWorker, '2026-08-14T13:01:00.000Z', {
		futureEventCount: 1
	});
	assert.equal(retried.transitionedRaces, 0);
});

test('replenishes the configured future pipeline after an event starts', async () => {
	await resetScheduleFixture(firstWorker);
	await makeEveryRacerEligible(firstWorker);
	await firstWorker
		.collection('leagues')
		.update('prlseeddemo0001', { maxPlayers: 4, prizeMoneyScaling: 1 });
	await reconcileSchedule(firstWorker, '2026-08-14T12:00:00.000Z');

	const replenished = await reconcileSchedule(secondWorker, '2026-08-14T13:00:00.000Z');
	const futureEvents = (await firstWorker.collection('events').getFullList()).filter(
		(event) => Date.parse(event.startTime) > Date.parse('2026-08-14T13:00:00.000Z')
	);

	assert.equal(replenished.createdEvents, 1);
	assert.equal(futureEvents.length, 2);
});

test('backfills pending league races when eligible racers become available', async () => {
	await resetScheduleFixture(firstWorker);
	await makeEveryRacerEligible(firstWorker);
	await firstWorker
		.collection('leagues')
		.update('prlseeddemo0001', { maxPlayers: 4, prizeMoneyScaling: 1 });
	await reconcileSchedule(firstWorker, '2026-08-14T12:00:00.000Z');
	await reconcileSchedule(firstWorker, '2026-08-14T13:00:00.000Z');

	const races = await firstWorker.collection('races').getFullList({
		filter: 'league = "prlseeddemo0001"',
		sort: 'startTime'
	});
	const completedRace = races[0];
	const unfilledRace = races[2];
	const completedRacers = await firstWorker.collection('racers').getFullList({
		filter: `race = "${completedRace.id}"`
	});
	await firstWorker.collection('races').update(completedRace.id, { status: 'settled' });
	await Promise.all(
		completedRacers.map((racer) =>
			firstWorker.collection('racers').update(racer.id, { race: null })
		)
	);

	const backfilled = await reconcileSchedule(secondWorker, '2026-08-14T13:30:00.000Z');
	const assigned = await firstWorker.collection('racers').getFullList({
		filter: `race = "${unfilledRace.id}"`
	});

	assert.equal(backfilled.assignedRacers, 4);
	assert.ok(assigned.length > 0 && assigned.length <= 4);
	assert.deepEqual(
		(await firstWorker.collection('races').getOne(unfilledRace.id)).prizeCurve,
		[4, 3, 2, 1]
	);
});

test('finds the live pipeline after more than one thousand historical events', async () => {
	await resetScheduleFixture(firstWorker);
	for (let batchStart = 0; batchStart < 1_001; batchStart += 100) {
		await Promise.all(
			Array.from({ length: Math.min(100, 1_001 - batchStart) }, (_, batchIndex) => {
				const index = batchStart + batchIndex;
				return firstWorker.collection('events').create({
					type: 'DailyLeagueRaces',
					scheduleKey: `historical:${index}`,
					startTime: new Date(Date.UTC(2020, 0, 1) + index * 60_000).toISOString(),
					raceIds: [],
					started: true,
					finished: true
				});
			})
		);
	}

	await reconcileSchedule(firstWorker, '2026-08-14T12:00:00.000Z', { futureEventCount: 1 });
	const retried = await reconcileSchedule(secondWorker, '2026-08-14T12:00:00.000Z', {
		futureEventCount: 1
	});

	assert.equal(retried.createdEvents, 0);
	assert.equal(retried.createdRaces, 0);
});
