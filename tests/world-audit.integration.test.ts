import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { NodePocketBase } from './support/node-pocketbase';
import {
	projectDirectory,
	startPocketBase,
	stopPocketBase,
	testSuperuserEmail,
	testSuperuserPassword
} from './support/pocketbase-test-server';

type Finding = {
	id: string;
	code: string;
	domain: string;
	repairability: 'safe' | 'review';
	recordIds: string[];
};

type AuditReport = {
	healthy: boolean;
	checkedDomains: string[];
	findings: Finding[];
	repair: {
		requested: string[];
		applied: Array<{ findingId: string; change: string }>;
		skipped: Array<{ findingId: string; reason: string }>;
	};
};

test(
	'world audit is clean for the seeded world and reports inconsistencies without guessing',
	{ timeout: 30_000 },
	async () => {
		const dataDirectory = await mkdtemp(join(tmpdir(), 'prl-world-audit-'));
		const port = 18_000 + Math.floor(Math.random() * 10_000);
		const baseUrl = `http://127.0.0.1:${port}`;
		let server: ChildProcess | undefined;
		try {
			server = await startPocketBase({
				baseUrl,
				port,
				dataDirectory,
				migrationsDirectory: join(projectDirectory, 'pocketbase', 'pb_migrations'),
				serviceEmail: 'world-audit@example.com',
				servicePassword: 'world-audit-password'
			});
			const service = new NodePocketBase(baseUrl);
			service.autoCancellation(false);
			await service
				.collection('users')
				.authWithPassword('world-audit@example.com', 'world-audit-password');
			const audit = (body: object = {}) =>
				service.send<AuditReport>('/api/prl/admin/world-audit', { method: 'POST', body });

			const clean = await audit();
			assert.equal(clean.healthy, true);
			assert.deepEqual(clean.findings, []);
			assert.deepEqual(clean.checkedDomains, [
				'species',
				'trainers',
				'racers',
				'free_agents',
				'leagues',
				'seasons',
				'races',
				'tracks',
				'wagers',
				'ledger',
				'trainer_results',
				'standings',
				'roster_history',
				'health',
				'valuation',
				'news'
			]);

			const superuser = new NodePocketBase(baseUrl);
			superuser.autoCancellation(false);
			await superuser
				.collection('_superusers')
				.authWithPassword(testSuperuserEmail, testSuperuserPassword);
			const racer = await superuser.collection('racers').getOne('prlseedracer001');
			await superuser.collection('racers').update(racer.id, {
				health: { ...racer.health, eligible: false },
				financials: {
					...racer.financials,
					currentSharePrice: 99,
					priceHistory: [
						{ price: 12, sourceEvent: 'event-one' },
						{ price: 13, sourceEvent: 'event-one' }
					]
				}
			});

			const unsafeEntrant = await audit();
			assert.equal(unsafeEntrant.healthy, false);
			assert.deepEqual(
				unsafeEntrant.findings.map(({ code }) => code),
				['duplicate_event_effect', 'ineligible_race_entrant', 'valuation_disagreement']
			);

			await superuser.collection('races').update('prlseedrace0001', { status: 'cancelled' });
			const stale = await audit();
			const staleFinding = stale.findings.find(({ code }) => code === 'stale_race_link');
			const duplicateFinding = stale.findings.find(({ code }) => code === 'duplicate_event_effect');
			assert.ok(staleFinding);
			assert.ok(duplicateFinding);
			assert.equal(staleFinding.repairability, 'safe');
			assert.equal(duplicateFinding.repairability, 'review');

			const repaired = await audit({
				repairFindingIds: [staleFinding.id, duplicateFinding.id]
			});
			assert.deepEqual(repaired.repair.applied, [
				{
					findingId: staleFinding.id,
					change: 'Cleared 8 stale racer race links.'
				}
			]);
			assert.deepEqual(repaired.repair.skipped, [
				{ findingId: duplicateFinding.id, reason: 'administrative_review_required' }
			]);
			assert.equal(
				repaired.findings.some(({ code }) => code === 'stale_race_link'),
				false
			);
			assert.equal((await superuser.collection('racers').getOne(racer.id)).race, '');

			const repeatedRepair = await audit({ repairFindingIds: [staleFinding.id] });
			assert.deepEqual(repeatedRepair.repair.applied, []);
			assert.deepEqual(repeatedRepair.repair.skipped, [
				{ findingId: staleFinding.id, reason: 'finding_not_present' }
			]);

			const unusedSpecies = await superuser
				.collection('pokemon')
				.getFirstListItem('pokedexNumber = 649');
			await superuser.collection('pokemon').delete(unusedSpecies.id);
			const freeAgent = await superuser.collection('racers').getOne('prlseedracer125');
			await superuser.collection('racers').update(freeAgent.id, {
				trainer: 'prlseedtrain001'
			});
			await superuser.collection('leagues').update('prlseeddemo0001', { maxPlayers: 19 });
			const standing = await superuser
				.collection('leagueStandings')
				.getFirstListItem(`racer = "${racer.id}"`);
			await superuser.collection('leagueStandings').update(standing.id, {
				league: 'prlseedleague02'
			});
			await superuser.collection('racetracks').update('175hl67e5pvjjib', {
				compatibleFormats: []
			});
			await superuser.collection('races').update('prlseedrace0001', { racetrack: null });

			const registration = await superuser.send<{ id: string }>('/api/prl/accounts/register', {
				method: 'POST',
				body: {
					email: 'audit-player@example.com',
					password: 'audit-player-password',
					passwordConfirm: 'audit-player-password'
				}
			});
			const ordinaryUser = new NodePocketBase(baseUrl);
			await ordinaryUser
				.collection('users')
				.authWithPassword('audit-player@example.com', 'audit-player-password');
			await assert.rejects(
				ordinaryUser.send('/api/prl/admin/world-audit', { method: 'POST', body: {} }),
				(error: { status?: number }) => error.status === 403
			);
			await superuser.collection('users').update(registration.id, { balance: 9999 });
			await superuser.collection('wagers').create({
				player: registration.id,
				race: 'prlseedrace0001',
				market: 'winner',
				selection: racer.id,
				stake: 10,
				odds: 2,
				potentialPayout: 20,
				status: 'open',
				payout: 0,
				idempotencyKey: 'audit-open-wager',
				placedAt: '2026-09-01T12:00:00.000Z',
				cutoffAt: '2026-09-01T12:30:00.000Z',
				cutoffSnapshotStatus: 'accepted'
			});
			await superuser.collection('events').create({
				type: 'RacerReleased',
				idempotencyKey: 'audit-missing-news',
				occurredAt: '2026-09-01T12:00:00.000Z',
				started: true,
				finished: true,
				facts: {}
			});

			const broadAudit = await audit();
			const broadCodes = new Set(broadAudit.findings.map(({ code }) => code));
			for (const expectedCode of [
				'invalid_species_population',
				'invalid_free_agent_population',
				'invalid_racer_assignment',
				'invalid_league_size',
				'invalid_season_assignment',
				'missing_race_track',
				'invalid_track_configuration',
				'unresolved_wager',
				'ledger_disagreement',
				'missing_news_effect',
				'duplicate_event_effect',
				'valuation_disagreement'
			]) {
				assert.equal(broadCodes.has(expectedCode), true, `expected ${expectedCode}`);
			}
		} finally {
			if (server) await stopPocketBase(server);
			await rm(dataDirectory, { recursive: true, force: true });
		}
	}
);
