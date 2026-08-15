import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { NodePocketBase } from './support/node-pocketbase';
import {
	createMigrationTestFixture,
	startPocketBase,
	stopPocketBase
} from './support/pocketbase-test-server';

const migrationName = '1786741100_repair_wager_lifecycle.js';
const serviceEmail = 'wager-migration@example.com';
const servicePassword = 'wager-migration-password';

test(
	'migration preserves open wagers without inventing unknown legacy cutoff terms',
	{ timeout: 30_000 },
	async () => {
		const fixture = await createMigrationTestFixture('prl-wager-migration-', migrationName);
		const { testDirectory, dataDirectory, legacyMigrations, migrationsDirectory, port, baseUrl } =
			fixture;
		const cutoff = '2099-08-15T14:00:00.000Z';
		await writeFile(
			join(legacyMigrations, '1786741050_seed_legacy_wager.js'),
			`migrate((app) => {
			const race = app.findRecordById('races', 'prlseedrace0001');
			race.set('status', 'pending');
			race.set('bettingCutoff', '${cutoff}');
			race.set('markets', { winnerType: 'winner', winnerName: 'Race winner', winnerCutoff: '${cutoff}', winnerSelections: [{ racerId: 'prlseedracer001', odds: 2 }] });
			app.save(race);
			const player = app.findRecordById('users', 'prlserviceuser0');
			player.set('balance', 9960);
			app.save(player);
			const wager = new Record(app.findCollectionByNameOrId('wagers'));
			wager.set('id', 'legacymigwager1');
			wager.set('player', player.id);
			wager.set('race', race.id);
			wager.set('market', 'winner');
			wager.set('selection', 'prlseedracer001');
			wager.set('stake', 40);
			wager.set('odds', 2);
			wager.set('potentialPayout', 80);
			wager.set('status', 'open');
			wager.set('payout', 0);
			wager.set('idempotencyKey', 'legacy-open-wager');
			wager.set('placedAt', '2026-08-15T13:00:00.000Z');
			app.save(wager);
			const entry = new Record(app.findCollectionByNameOrId('accountLedger'));
			entry.set('player', player.id);
			entry.set('wager', wager.id);
			entry.set('type', 'wager_reserve');
			entry.set('balanceDelta', -40);
			entry.set('balanceAfter', 9960);
			entry.set('quantityDelta', 0);
			entry.set('quantityAfter', 0);
			entry.set('unitPrice', 2);
			entry.set('costBasisAfter', 0);
			entry.set('occurredAt', '2099-08-15T13:00:00.000Z');
			app.save(entry);
			for (let index = 0; index < 5001; index += 1) {
				const historical = new Record(app.findCollectionByNameOrId('wagers'));
				historical.set('id', 'lh' + String(index).padStart(13, '0'));
				historical.set('player', player.id);
				historical.set('race', race.id);
				historical.set('market', 'winner');
				historical.set('selection', 'prlseedracer001');
				historical.set('stake', 1);
				historical.set('odds', 2);
				historical.set('potentialPayout', 2);
				historical.set('status', 'lost');
				historical.set('payout', 0);
				historical.set('idempotencyKey', 'legacy-history-' + index);
				historical.set('placedAt', '2099-08-14T13:00:00.000Z');
				historical.set('resolvedAt', '2099-08-14T14:00:00.000Z');
				app.save(historical);
				const historicalEntry = new Record(app.findCollectionByNameOrId('accountLedger'));
				historicalEntry.set('player', player.id);
				historicalEntry.set('wager', historical.id);
				historicalEntry.set('type', 'wager_reserve');
				historicalEntry.set('balanceDelta', -1);
				historicalEntry.set('balanceAfter', 9999 - index);
				historicalEntry.set('quantityDelta', 0);
				historicalEntry.set('quantityAfter', 0);
				historicalEntry.set('unitPrice', 2);
				historicalEntry.set('costBasisAfter', 0);
				historicalEntry.set('occurredAt', '2099-08-14T13:00:00.000Z');
				app.save(historicalEntry);
			}
			player.set('balance', 4959);
			app.save(player);
		}, (app) => {});`
		);

		let server: ChildProcess | undefined;
		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: legacyMigrations,
				serviceEmail,
				servicePassword
			});
			await stopPocketBase(server);
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory,
				serviceEmail,
				servicePassword
			});
			const client = new NodePocketBase(baseUrl);
			client.autoCancellation(false);
			await client.collection('users').authWithPassword(serviceEmail, servicePassword);

			const wager = await client.collection('wagers').getOne('legacymigwager1');
			assert.deepEqual(
				{
					status: wager.status,
					stake: wager.stake,
					odds: wager.odds,
					potentialPayout: wager.potentialPayout,
					cutoffAt: wager.cutoffAt,
					cutoffSnapshotStatus: wager.cutoffSnapshotStatus
				},
				{
					status: 'open',
					stake: 40,
					odds: 2,
					potentialPayout: 80,
					cutoffAt: '',
					cutoffSnapshotStatus: 'unknown_legacy'
				}
			);
			const reserve = await client
				.collection('accountLedger')
				.getFirstListItem('wager = "legacymigwager1" && type = "wager_reserve"');
			assert.deepEqual(
				{
					reason: reserve.reason,
					sourceKey: reserve.sourceKey,
					balanceDelta: reserve.balanceDelta
				},
				{
					reason: 'stake_reserved',
					sourceKey: 'wager:legacymigwager1:reserve',
					balanceDelta: -40
				}
			);
			const account = (await client.send('/api/prl/wagers/account', {})) as {
				balance: number;
				ledgerBalance: number;
				reconciled: boolean;
				openWagers: Array<{ id: string }>;
				historicalWagers: Array<{ id: string }>;
			};
			assert.equal((await client.collection('users').authRefresh()).record.balance, 4_959);
			assert.equal(account.balance, 4_959);
			assert.equal(account.ledgerBalance, 4_959);
			assert.equal(account.reconciled, true);
			assert.deepEqual(
				account.openWagers.map((item) => item.id),
				['legacymigwager1']
			);
			assert.equal(account.historicalWagers.length, 5_001);
			const replayed = await client.send('/api/prl/wagers/place', {
				method: 'POST',
				body: {
					raceId: 'prlseedrace0001',
					market: 'winner',
					selection: 'prlseedracer001',
					stake: 40,
					idempotencyKey: 'legacy-open-wager'
				}
			});
			assert.deepEqual(replayed, {
				id: 'legacymigwager1',
				status: 'open',
				balance: 9_960,
				stake: 40,
				odds: 2,
				potentialPayout: 80,
				cutoffAt: '',
				cutoffSnapshotStatus: 'unknown_legacy'
			});
			assert.equal((await client.collection('wagers').getFullList()).length, 5_002);
		} finally {
			if (server) await stopPocketBase(server);
			await rm(testDirectory, { recursive: true, force: true });
		}
	}
);
