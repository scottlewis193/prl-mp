import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type PocketBase from 'pocketbase';
import type { WagerAccount } from '../src/lib/wagerAccount';
import { NodePocketBase } from './support/node-pocketbase';
import {
	projectDirectory,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const startingBalance = 10_000;
const serviceEmail = 'economy-service@example.com';
const servicePassword = 'economy-service-password';

let dataDirectory = '';
let server: ChildProcess;
let baseUrl = '';
let serviceClient: PocketBase;

function pocketBaseClient(): PocketBase {
	return new NodePocketBase(baseUrl);
}

async function registerPlayer(email: string): Promise<PocketBase> {
	const client = pocketBaseClient();
	client.autoCancellation(false);
	await client.send('/api/prl/accounts/register', {
		method: 'POST',
		body: {
			email,
			password: 'player-password',
			passwordConfirm: 'player-password',
			options: { raceViewer: { leaderboardMode: 'interval', isViewing: false } },
			watchlist: []
		}
	});
	await client.collection('users').authWithPassword(email, 'player-password');
	return client;
}

before(async () => {
	dataDirectory = await mkdtemp(join(tmpdir(), 'prl-economy-test-'));
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
	serviceClient = pocketBaseClient();
	serviceClient.autoCancellation(false);
	await serviceClient.collection('users').authWithPassword(serviceEmail, servicePassword);
});

after(async () => {
	if (server) await stopPocketBase(server);
	await rm(dataDirectory, { recursive: true, force: true });
});

test('migration backfills existing accounts and registration provisions a balanced opening entry', async () => {
	assert.equal(serviceClient.authStore.record?.balance, startingBalance);
	const serviceEntries = await serviceClient.collection('accountLedger').getFullList();
	assert.deepEqual(
		serviceEntries.map((entry) => ({ type: entry.type, balanceDelta: entry.balanceDelta })),
		[{ type: 'account_opened', balanceDelta: startingBalance }]
	);

	const player = await registerPlayer('new-player@example.com');
	assert.equal(player.authStore.record?.balance, startingBalance);
	const entries = await player.collection('accountLedger').getFullList();
	assert.deepEqual(
		entries.map((entry) => ({
			type: entry.type,
			balanceDelta: entry.balanceDelta,
			balanceAfter: entry.balanceAfter,
			quantityDelta: entry.quantityDelta
		})),
		[
			{
				type: 'account_opened',
				balanceDelta: startingBalance,
				balanceAfter: startingBalance,
				quantityDelta: 0
			}
		]
	);
});

test('placing a wager atomically reserves funds and replays the immutable result', async () => {
	const player = await registerPlayer('wager-player@example.com');
	const raceId = 'prlseedrace0001';
	const cutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		startTime: cutoff,
		bettingCutoff: cutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2.5 }]
		}
	});
	const order = {
		raceId,
		market: 'winner',
		selection: 'prlseedracer001',
		stake: 20,
		idempotencyKey: 'winner-20'
	};

	const placed = await player.send('/api/prl/wagers/place', { method: 'POST', body: order });
	const replayed = await player.send('/api/prl/wagers/place', { method: 'POST', body: order });

	assert.deepEqual(replayed, placed);
	assert.deepEqual(placed, {
		id: (placed as { id: string }).id,
		status: 'open',
		balance: 9_980,
		stake: 20,
		odds: 2.5,
		potentialPayout: 50,
		cutoffAt: cutoff.replace('T', ' '),
		cutoffSnapshotStatus: 'accepted'
	});
	const wagers = await player.collection('wagers').getFullList();
	assert.equal(wagers.length, 1);
	assert.deepEqual(
		wagers.map((wager) => ({
			race: wager.race,
			market: wager.market,
			selection: wager.selection,
			stake: wager.stake,
			odds: wager.odds,
			potentialPayout: wager.potentialPayout,
			cutoffAt: wager.cutoffAt,
			cutoffSnapshotStatus: wager.cutoffSnapshotStatus,
			status: wager.status
		})),
		[
			{
				race: raceId,
				market: 'winner',
				selection: 'prlseedracer001',
				stake: 20,
				odds: 2.5,
				potentialPayout: 50,
				cutoffAt: cutoff.replace('T', ' '),
				cutoffSnapshotStatus: 'accepted',
				status: 'open'
			}
		]
	);
	const entries = await player.collection('accountLedger').getFullList({ sort: 'occurredAt,id' });
	assert.deepEqual(
		entries.map((entry) => ({
			type: entry.type,
			balanceDelta: entry.balanceDelta,
			reason: entry.reason,
			sourceKey: entry.sourceKey
		})),
		[
			{ type: 'account_opened', balanceDelta: 10_000, reason: '', sourceKey: '' },
			{
				type: 'wager_reserve',
				balanceDelta: -20,
				reason: 'stake_reserved',
				sourceKey: `wager:${(placed as { id: string }).id}:reserve`
			}
		]
	);

	const account = (await player.send('/api/prl/wagers/account', {})) as {
		balance: number;
		ledgerBalance: number;
		reconciled: boolean;
		openWagers: Array<{
			id: string;
			raceId: string;
			raceName: string;
			market: string;
			selection: string;
			selectionName: string;
			stake: number;
			odds: number;
			potentialPayout: number;
			cutoffAt: string;
			cutoffSnapshotStatus: 'accepted' | 'unknown_legacy';
			placedAt: string;
			status: string;
			payout: number;
			resolvedAt: string;
		}>;
		historicalWagers: Array<{ id: string }>;
	};
	assert.deepEqual(account, {
		balance: 9_980,
		ledgerBalance: 9_980,
		reconciled: true,
		openWagers: [
			{
				id: (placed as { id: string }).id,
				raceId,
				raceName: 'Starter League Opening Race',
				market: 'winner',
				selection: 'prlseedracer001',
				selectionName: "Ash's pikachu",
				stake: 20,
				odds: 2.5,
				potentialPayout: 50,
				cutoffAt: cutoff.replace('T', ' '),
				cutoffSnapshotStatus: 'accepted',
				placedAt: account.openWagers[0].placedAt,
				status: 'open',
				payout: 0,
				resolvedAt: ''
			}
		],
		historicalWagers: []
	});
});

test('concurrent wager placement cannot double debit, overspend, or cross account ownership', async () => {
	const firstClient = await registerPlayer('concurrent-wager@example.com');
	const secondClient = pocketBaseClient();
	secondClient.autoCancellation(false);
	await secondClient
		.collection('users')
		.authWithPassword('concurrent-wager@example.com', 'player-password');
	const otherPlayer = await registerPlayer('other-wager-player@example.com');
	const raceId = 'prlseedrace0001';
	const cutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff: cutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2 }]
		}
	});
	const order = {
		raceId,
		market: 'winner',
		selection: 'prlseedracer001',
		stake: 6_000,
		idempotencyKey: 'same-wager-request'
	};
	const duplicateAttempts = await Promise.all([
		firstClient.send('/api/prl/wagers/place', { method: 'POST', body: order }),
		secondClient.send('/api/prl/wagers/place', { method: 'POST', body: order })
	]);
	assert.deepEqual(duplicateAttempts[1], duplicateAttempts[0]);

	const overspendAttempts = await Promise.allSettled([
		firstClient.send('/api/prl/wagers/place', {
			method: 'POST',
			body: { ...order, idempotencyKey: 'overspend-a' }
		}),
		secondClient.send('/api/prl/wagers/place', {
			method: 'POST',
			body: { ...order, idempotencyKey: 'overspend-b' }
		})
	]);
	assert.equal(
		overspendAttempts.every((attempt) => attempt.status === 'rejected'),
		true
	);
	assert.equal((await firstClient.collection('users').authRefresh()).record.balance, 4_000);
	assert.equal((await firstClient.collection('wagers').getFullList()).length, 1);
	assert.equal(
		(
			await firstClient
				.collection('accountLedger')
				.getFullList({ filter: 'type = "wager_reserve"' })
		).length,
		1
	);
	assert.deepEqual(await otherPlayer.collection('wagers').getFullList(), []);
	await assert.rejects(
		() => otherPlayer.collection('wagers').getOne((duplicateAttempts[0] as { id: string }).id),
		(error: { status?: number }) => error.status === 404
	);
});

test('account projections remain internally consistent during concurrent placement', async () => {
	const player = await registerPlayer('concurrent-wager-projection@example.com');
	const placementClient = pocketBaseClient();
	placementClient.autoCancellation(false);
	await placementClient
		.collection('users')
		.authWithPassword('concurrent-wager-projection@example.com', 'player-password');
	const raceId = 'prlseedrace0001';
	const cutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff: cutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2 }]
		}
	});

	const attempts = await Promise.all([
		...Array.from({ length: 20 }, () => player.send<WagerAccount>('/api/prl/wagers/account', {})),
		placementClient.send('/api/prl/wagers/place', {
			method: 'POST',
			body: {
				raceId,
				market: 'winner',
				selection: 'prlseedracer001',
				stake: 10,
				idempotencyKey: 'projection-race'
			}
		})
	]);
	for (const account of attempts.slice(0, -1) as WagerAccount[]) {
		assert.equal(account.reconciled, true);
		assert.equal(account.balance, account.ledgerBalance);
		assert.equal(account.historicalWagers.length, 0);
		assert.equal(account.openWagers.length === 0 || account.openWagers.length === 1, true);
		assert.equal(account.balance, account.openWagers.length === 0 ? 10_000 : 9_990);
	}
});

test('the race cutoff closes placement and a recorded wager cannot be changed', async () => {
	const player = await registerPlayer('cutoff-player@example.com');
	const raceId = 'prlseedrace0001';
	const marketCutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff: new Date(Date.now() - 1).toISOString(),
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: marketCutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2 }]
		}
	});

	await assert.rejects(
		() =>
			player.send('/api/prl/wagers/place', {
				method: 'POST',
				body: {
					raceId,
					market: 'winner',
					selection: 'prlseedracer001',
					stake: 10,
					idempotencyKey: 'after-cutoff'
				}
			}),
		/closed/i
	);
	assert.equal((await player.collection('users').authRefresh()).record.balance, 10_000);

	await serviceClient.collection('races').update(raceId, { bettingCutoff: marketCutoff });
	const placed = (await player.send('/api/prl/wagers/place', {
		method: 'POST',
		body: {
			raceId,
			market: 'winner',
			selection: 'prlseedracer001',
			stake: 10,
			idempotencyKey: 'immutable-wager'
		}
	})) as { id: string };
	await assert.rejects(
		() => player.collection('wagers').update(placed.id, { stake: 1 }),
		/authorized|permission|missing|superusers/i
	);
});

test('invalid, unaffordable, and reused request keys leave wagering accounts unchanged', async () => {
	const player = await registerPlayer('rejected-wager@example.com');
	const raceId = 'prlseedrace0001';
	const cutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff: cutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2.5 }]
		}
	});
	const baseOrder = {
		raceId,
		market: 'winner',
		selection: 'prlseedracer001',
		stake: 10,
		idempotencyKey: 'rejected-request'
	};
	for (const body of [
		{ ...baseOrder, selection: 'prlseedracer002' },
		{ ...baseOrder, stake: 10.001 },
		{ ...baseOrder, stake: startingBalance + 1 }
	]) {
		await assert.rejects(
			() => player.send('/api/prl/wagers/place', { method: 'POST', body }),
			(error: { status?: number }) => error.status === 400
		);
	}
	const staleSelection = await serviceClient.collection('racers').getOne('prlseedracer002');
	await serviceClient.collection('racers').update(staleSelection.id, { race: null });
	await serviceClient.collection('races').update(raceId, {
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: staleSelection.id, odds: 3 }]
		}
	});
	await assert.rejects(
		() =>
			player.send('/api/prl/wagers/place', {
				method: 'POST',
				body: { ...baseOrder, selection: staleSelection.id }
			}),
		/not participating/i
	);
	await serviceClient.collection('racers').update(staleSelection.id, { race: raceId });
	await serviceClient.collection('races').update(raceId, {
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2.5 }]
		}
	});
	assert.equal((await player.collection('users').authRefresh()).record.balance, startingBalance);
	assert.deepEqual(await player.collection('wagers').getFullList(), []);
	assert.deepEqual(
		(await player.collection('accountLedger').getFullList()).map((entry) => entry.type),
		['account_opened']
	);

	await player.send('/api/prl/wagers/place', {
		method: 'POST',
		body: { ...baseOrder, idempotencyKey: 'accepted-then-reused' }
	});
	await assert.rejects(
		() =>
			player.send('/api/prl/wagers/place', {
				method: 'POST',
				body: { ...baseOrder, stake: 11, idempotencyKey: 'accepted-then-reused' }
			}),
		/reused|another wager/i
	);
	assert.equal(
		(await player.collection('users').authRefresh()).record.balance,
		startingBalance - 10
	);
	assert.equal((await player.collection('wagers').getFullList()).length, 1);
});

test('the service voids a market atomically and refunds its reserved stake exactly once', async () => {
	const player = await registerPlayer('voided-wager@example.com');
	const raceId = 'prlseedrace0001';
	const cutoff = new Date(Date.now() + 60_000).toISOString();
	await serviceClient.collection('races').update(raceId, {
		status: 'pending',
		bettingCutoff: cutoff,
		markets: {
			winnerType: 'winner',
			winnerName: 'Race winner',
			winnerCutoff: cutoff,
			winnerSelections: [{ racerId: 'prlseedracer001', odds: 2 }]
		}
	});
	const placed = (await player.send('/api/prl/wagers/place', {
		method: 'POST',
		body: {
			raceId,
			market: 'winner',
			selection: 'prlseedracer001',
			stake: 25,
			idempotencyKey: 'void-this-wager'
		}
	})) as { id: string };

	await assert.rejects(
		() => player.send('/api/prl/races/void', { method: 'POST', body: { raceId } }),
		(error: { status?: number }) => error.status === 403
	);
	const voided = (await serviceClient.send('/api/prl/races/void', {
		method: 'POST',
		body: { raceId }
	})) as { voided: boolean; refundedWagers: number };
	assert.equal(voided.voided, true);
	assert.equal(voided.refundedWagers >= 1, true);
	assert.deepEqual(
		await serviceClient.send('/api/prl/races/void', { method: 'POST', body: { raceId } }),
		{ voided: false, refundedWagers: 0 }
	);

	const wager = await player.collection('wagers').getOne(placed.id);
	assert.deepEqual(
		{ status: wager.status, payout: wager.payout },
		{ status: 'refunded', payout: 25 }
	);
	assert.equal((await player.collection('users').authRefresh()).record.balance, startingBalance);
	const refundEntries = await player.collection('accountLedger').getFullList({
		filter: `wager = "${placed.id}" && type = "wager_refund"`
	});
	assert.deepEqual(
		refundEntries.map((entry) => ({
			balanceDelta: entry.balanceDelta,
			reason: entry.reason,
			sourceKey: entry.sourceKey
		})),
		[
			{
				balanceDelta: 25,
				reason: 'voided_market_refund',
				sourceKey: `wager:${placed.id}:refund`
			}
		]
	);
	const account = (await player.send('/api/prl/wagers/account', {})) as {
		balance: number;
		ledgerBalance: number;
		reconciled: boolean;
		openWagers: unknown[];
		historicalWagers: Array<{ id: string; status: string; payout: number }>;
	};
	assert.equal(account.reconciled, true);
	assert.equal(account.balance, account.ledgerBalance);
	assert.deepEqual(account.openWagers, []);
	assert.deepEqual(
		account.historicalWagers.map(({ id, status, payout }) => ({ id, status, payout })),
		[{ id: placed.id, status: 'refunded', payout: 25 }]
	);
});

test('buying derives the total from the racer price and atomically records balance, holding, and ledger', async () => {
	const player = await registerPlayer('buyer@example.com');
	const result = (await player.send('/api/prl/economy/trade', {
		method: 'POST',
		body: {
			racerId: 'prlseedracer001',
			side: 'buy',
			quantity: 5,
			total: 1,
			idempotencyKey: 'buy-5',
			expectedUnitPrice: 10
		}
	})) as {
		balance: number;
		holding: { quantity: number; costBasis: number };
	};

	assert.deepEqual(result, {
		balance: 9_950,
		holding: { quantity: 5, costBasis: 50 },
		availableSupply: 995
	});
	const refreshed = await player.collection('users').authRefresh();
	assert.equal(refreshed.record.balance, 9_950);
	const holdings = await player.collection('holdings').getFullList();
	assert.deepEqual(
		holdings.map((holding) => ({
			racer: holding.racer,
			quantity: holding.quantity,
			costBasis: holding.costBasis
		})),
		[{ racer: 'prlseedracer001', quantity: 5, costBasis: 50 }]
	);
	const entries = await player.collection('accountLedger').getFullList({ sort: 'occurredAt,id' });
	assert.deepEqual(
		entries.map((entry) => ({
			type: entry.type,
			balanceDelta: entry.balanceDelta,
			balanceAfter: entry.balanceAfter,
			quantityDelta: entry.quantityDelta,
			quantityAfter: entry.quantityAfter,
			unitPrice: entry.unitPrice,
			costBasisAfter: entry.costBasisAfter
		})),
		[
			{
				type: 'account_opened',
				balanceDelta: 10_000,
				balanceAfter: 10_000,
				quantityDelta: 0,
				quantityAfter: 0,
				unitPrice: 0,
				costBasisAfter: 0
			},
			{
				type: 'buy',
				balanceDelta: -50,
				balanceAfter: 9_950,
				quantityDelta: 5,
				quantityAfter: 5,
				unitPrice: 10,
				costBasisAfter: 50
			}
		]
	);
});

test('selling credits the server-priced proceeds and reduces cost basis proportionally', async () => {
	const player = await registerPlayer('seller@example.com');
	await player.send('/api/prl/economy/trade', {
		method: 'POST',
		body: {
			racerId: 'prlseedracer005',
			side: 'buy',
			quantity: 5,
			idempotencyKey: 'buy-before-sale',
			expectedUnitPrice: 10
		}
	});

	const result = await player.send('/api/prl/economy/trade', {
		method: 'POST',
		body: {
			racerId: 'prlseedracer005',
			side: 'sell',
			quantity: 2,
			idempotencyKey: 'sell-2',
			expectedUnitPrice: 10
		}
	});
	assert.deepEqual(result, {
		balance: 9_970,
		holding: { quantity: 3, costBasis: 30 },
		availableSupply: 997
	});

	const holding = await player.collection('holdings').getFirstListItem('racer = "prlseedracer005"');
	assert.deepEqual(
		{ quantity: holding.quantity, costBasis: holding.costBasis },
		{ quantity: 3, costBasis: 30 }
	);
	const entries = await player.collection('accountLedger').getFullList({ sort: 'occurredAt,id' });
	assert.deepEqual(
		entries.map((entry) => ({
			type: entry.type,
			balanceDelta: entry.balanceDelta,
			balanceAfter: entry.balanceAfter,
			quantityDelta: entry.quantityDelta,
			quantityAfter: entry.quantityAfter,
			costBasisAfter: entry.costBasisAfter
		})),
		[
			{
				type: 'account_opened',
				balanceDelta: 10_000,
				balanceAfter: 10_000,
				quantityDelta: 0,
				quantityAfter: 0,
				costBasisAfter: 0
			},
			{
				type: 'buy',
				balanceDelta: -50,
				balanceAfter: 9_950,
				quantityDelta: 5,
				quantityAfter: 5,
				costBasisAfter: 50
			},
			{
				type: 'sell',
				balanceDelta: 20,
				balanceAfter: 9_970,
				quantityDelta: -2,
				quantityAfter: 3,
				costBasisAfter: 30
			}
		]
	);
});

test('insufficient funds and direct economic mutations are rejected without partial accounting changes', async () => {
	const player = await registerPlayer('protected-account@example.com');
	await assert.rejects(
		() =>
			player.send('/api/prl/economy/trade', {
				method: 'POST',
				body: {
					racerId: 'prlseedracer006',
					side: 'buy',
					quantity: 1_001,
					idempotencyKey: 'too-expensive',
					expectedUnitPrice: 10
				}
			}),
		(error: { status?: number; message?: string }) =>
			error.status === 400 && error.message === 'Insufficient funds.'
	);
	await assert.rejects(() =>
		player.collection('users').update(player.authStore.record!.id, { balance: 1_000_000 })
	);
	await assert.rejects(() =>
		player.collection('holdings').create({
			player: player.authStore.record!.id,
			racer: 'prlseedracer001',
			quantity: 100,
			costBasis: 0
		})
	);
	await assert.rejects(() =>
		player.collection('accountLedger').create({
			player: player.authStore.record!.id,
			type: 'account_opened',
			balanceDelta: 1_000_000,
			balanceAfter: 1_010_000,
			occurredAt: new Date().toISOString()
		})
	);

	const refreshed = await player.collection('users').authRefresh();
	assert.equal(refreshed.record.balance, startingBalance);
	assert.deepEqual(await player.collection('holdings').getFullList(), []);
	const entries = await player.collection('accountLedger').getFullList();
	assert.deepEqual(
		entries.map((entry) => ({ type: entry.type, balanceAfter: entry.balanceAfter })),
		[{ type: 'account_opened', balanceAfter: startingBalance }]
	);
});

test('concurrent purchases cannot overspend and ledger totals reconcile to the durable account state', async () => {
	const firstClient = await registerPlayer('concurrent-buyer@example.com');
	const secondClient = pocketBaseClient();
	secondClient.autoCancellation(false);
	await secondClient
		.collection('users')
		.authWithPassword('concurrent-buyer@example.com', 'player-password');

	const attempts = await Promise.allSettled(
		[firstClient, secondClient].map((client, index) =>
			client.send('/api/prl/economy/trade', {
				method: 'POST',
				body: {
					racerId: 'prlseedracer007',
					side: 'buy',
					quantity: 600,
					idempotencyKey: `concurrent-buy-${index}`,
					expectedUnitPrice: 10
				}
			})
		)
	);
	assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
	assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
	const rejected = attempts.find((attempt) => attempt.status === 'rejected');
	assert(rejected?.status === 'rejected');
	assert.equal((rejected.reason as { status?: number }).status, 400);
	assert.equal((rejected.reason as { message?: string }).message, 'Insufficient funds.');

	const refreshed = await firstClient.collection('users').authRefresh();
	const [holding] = await firstClient.collection('holdings').getFullList();
	const entries = await firstClient.collection('accountLedger').getFullList();
	assert.equal(refreshed.record.balance, 4_000);
	assert.deepEqual(
		{ quantity: holding.quantity, costBasis: holding.costBasis },
		{ quantity: 600, costBasis: 6_000 }
	);
	assert.equal(
		entries.reduce((total, entry) => total + entry.balanceDelta, 0),
		refreshed.record.balance
	);
	assert.equal(
		entries.reduce((total, entry) => total + entry.quantityDelta, 0),
		holding.quantity
	);
});

test('purchases enforce and atomically reduce available racer supply', async () => {
	const buyer = await registerPlayer('supply-buyer@example.com');
	const otherBuyer = await registerPlayer('supply-other@example.com');
	const result = await buyer.send('/api/prl/economy/trade', {
		method: 'POST',
		body: {
			racerId: 'prlseedracer002',
			side: 'buy',
			quantity: 1_000,
			idempotencyKey: 'take-all-supply',
			expectedUnitPrice: 10
		}
	});
	assert.deepEqual(result, {
		balance: 0,
		holding: { quantity: 1_000, costBasis: 10_000 },
		availableSupply: 0
	});
	await assert.rejects(
		() =>
			otherBuyer.send('/api/prl/economy/trade', {
				method: 'POST',
				body: {
					racerId: 'prlseedracer002',
					side: 'buy',
					quantity: 1,
					idempotencyKey: 'supply-exhausted',
					expectedUnitPrice: 10
				}
			}),
		(error: { status?: number; message?: string }) =>
			error.status === 400 && error.message === 'Insufficient share supply.'
	);
	const racer = await serviceClient.collection('racers').getOne('prlseedracer002');
	assert.equal(racer.financials.outstandingShares, 0);
});

test('duplicate trade submissions return the original result without charging twice', async () => {
	const player = await registerPlayer('idempotent-buyer@example.com');
	const request = {
		method: 'POST',
		body: {
			racerId: 'prlseedracer003',
			side: 'buy',
			quantity: 4,
			idempotencyKey: 'stable-client-request',
			expectedUnitPrice: 10
		}
	};
	const [first, duplicate] = await Promise.all([
		player.send('/api/prl/economy/trade', request),
		player.send('/api/prl/economy/trade', request)
	]);
	assert.deepEqual(duplicate, first);
	const refreshed = await player.collection('users').authRefresh();
	assert.equal(refreshed.record.balance, 9_960);
	const entries = await player.collection('accountLedger').getFullList({ filter: 'type = "buy"' });
	assert.equal(entries.length, 1);
});

test('a changed server price rejects the stale preview without partial updates', async () => {
	const player = await registerPlayer('stale-quote@example.com');
	await assert.rejects(
		() =>
			player.send('/api/prl/economy/trade', {
				method: 'POST',
				body: {
					racerId: 'prlseedracer008',
					side: 'buy',
					quantity: 2,
					idempotencyKey: 'stale-price',
					expectedUnitPrice: 9
				}
			}),
		(error: { status?: number; message?: string }) =>
			error.status === 400 && error.message === 'The share price changed. Review the updated quote.'
	);
	const refreshed = await player.collection('users').authRefresh();
	assert.equal(refreshed.record.balance, startingBalance);
	assert.deepEqual(await player.collection('holdings').getFullList(), []);
	const entries = await player.collection('accountLedger').getFullList();
	assert.deepEqual(
		entries.map((entry) => entry.type),
		['account_opened']
	);
});

test('concurrent sales cannot oversell a holding', async () => {
	const firstClient = await registerPlayer('concurrent-seller@example.com');
	const secondClient = pocketBaseClient();
	secondClient.autoCancellation(false);
	await secondClient
		.collection('users')
		.authWithPassword('concurrent-seller@example.com', 'player-password');
	await firstClient.send('/api/prl/economy/trade', {
		method: 'POST',
		body: {
			racerId: 'prlseedracer004',
			side: 'buy',
			quantity: 10,
			idempotencyKey: 'seed-sale-holding',
			expectedUnitPrice: 10
		}
	});

	const attempts = await Promise.allSettled(
		[firstClient, secondClient].map((client, index) =>
			client.send('/api/prl/economy/trade', {
				method: 'POST',
				body: {
					racerId: 'prlseedracer004',
					side: 'sell',
					quantity: 7,
					idempotencyKey: `concurrent-sell-${index}`,
					expectedUnitPrice: 10
				}
			})
		)
	);
	assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
	assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
	const holding = await firstClient
		.collection('holdings')
		.getFirstListItem('racer = "prlseedracer004"');
	assert.equal(holding.quantity, 3);
});
