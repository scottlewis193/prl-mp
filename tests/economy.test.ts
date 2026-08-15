import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type PocketBase from 'pocketbase';
import { NodePocketBase } from './support/node-pocketbase';

const projectDirectory = resolve(import.meta.dirname, '..');
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

async function waitForPocketBase(url: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			const response = await fetch(`${url}/api/health`);
			if (response.ok) return;
		} catch {
			// The child process is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
	throw new Error('Timed out waiting for the PocketBase test server');
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
	server = spawn(
		join(projectDirectory, 'pocketbase', 'pocketbase'),
		[
			'serve',
			`--http=127.0.0.1:${port}`,
			`--dir=${dataDirectory}`,
			`--migrationsDir=${join(projectDirectory, 'pocketbase', 'pb_migrations')}`,
			`--hooksDir=${join(projectDirectory, 'pocketbase', 'pb_hooks')}`,
			'--hooksWatch=false'
		],
		{
			cwd: projectDirectory,
			env: {
				...process.env,
				PB_USER: serviceEmail,
				PB_PASS: servicePassword
			} as unknown as NodeJS.ProcessEnv,
			stdio: 'ignore'
		}
	);

	await waitForPocketBase(baseUrl);
	serviceClient = pocketBaseClient();
	serviceClient.autoCancellation(false);
	await serviceClient.collection('users').authWithPassword(serviceEmail, servicePassword);
});

after(async () => {
	if (server && server.exitCode === null) {
		server.kill('SIGTERM');
		await once(server, 'exit');
	}
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
		potentialPayout: 50
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
				status: 'open'
			}
		]
	);
	const entries = await player.collection('accountLedger').getFullList({ sort: 'occurredAt,id' });
	assert.deepEqual(
		entries.map((entry) => ({ type: entry.type, balanceDelta: entry.balanceDelta })),
		[
			{ type: 'account_opened', balanceDelta: 10_000 },
			{ type: 'wager_reserve', balanceDelta: -20 }
		]
	);
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
