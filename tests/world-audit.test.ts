import assert from 'node:assert/strict';
import test from 'node:test';

import worldAudit from '../pocketbase/pb_hooks/worldAudit.cjs';

test('world audit detects repeated durable effects across every event projection', () => {
	const findings = worldAudit.auditWorld(
		{
			species: [],
			trainers: [],
			racers: [
				{
					id: 'racer-1',
					retired: true,
					trainerId: '',
					leagueId: '',
					raceId: '',
					healthEligible: true,
					price: 10,
					priceHistory: [],
					raceHistory: {
						totalRaces: 2,
						wins: 2,
						races: [
							{ raceId: 'race-1', position: 1 },
							{ raceId: 'race-1', position: 1 }
						]
					}
				}
			],
			leagues: [],
			seasons: [{ id: 'season-1', status: 'active' }],
			standings: [
				{
					id: 'standing-1',
					seasonId: 'season-1',
					leagueId: 'league-1',
					racerId: 'racer-1',
					points: 20,
					starts: 2,
					wins: 2,
					podiums: 2
				}
			],
			races: [
				{
					id: 'race-1',
					status: 'settled',
					trackId: 'track-1',
					seasonId: 'season-1',
					awardedPrizes: [
						{ racerId: 'racer-1', amount: 10 },
						{ racerId: 'racer-1', amount: 10 }
					]
				}
			],
			tracks: [],
			trainerResults: [
				{ id: 'trainer-result-1', raceId: 'race-1', racerId: 'racer-1' },
				{ id: 'trainer-result-2', raceId: 'race-1', racerId: 'racer-1' }
			],
			rosterHistory: [
				{ id: 'roster-1', sourceEventId: 'event-roster' },
				{ id: 'roster-2', sourceEventId: 'event-roster' }
			],
			healthConditions: [
				{ id: 'condition-1', sourceEventId: 'event-health', recoveryEventId: '' },
				{ id: 'condition-2', sourceEventId: 'event-health', recoveryEventId: '' }
			],
			wagers: [
				{
					id: 'wager-1',
					raceId: 'race-1',
					status: 'won',
					idempotencyKey: 'wager-request'
				},
				{
					id: 'wager-2',
					raceId: 'race-1',
					status: 'won',
					idempotencyKey: 'wager-request'
				}
			],
			users: [],
			ledger: [
				{
					id: 'ledger-1',
					playerId: 'player-1',
					wagerId: 'wager-1',
					type: 'wager_payout',
					sourceKey: 'wager:wager-1:payout'
				},
				{
					id: 'ledger-2',
					playerId: 'player-1',
					wagerId: 'wager-1',
					type: 'wager_payout',
					sourceKey: 'wager:wager-1:payout'
				}
			],
			events: [
				{
					id: 'event-race',
					type: 'AuditFixture',
					facts: {
						raceId: 'race-1',
						seasonPoints: [
							{ racerId: 'racer-1', points: 10 },
							{ racerId: 'racer-1', points: 10 }
						]
					}
				}
			],
			news: []
		},
		{
			speciesCount: 0,
			trainerCount: 0,
			activeRacerCount: 0,
			freeAgentCount: 0,
			minimumTrackCount: 0
		}
	);

	const duplicateFindings = findings.filter(({ code }) => code === 'duplicate_event_effect');
	assert.deepEqual(
		new Set(duplicateFindings.map(({ domain }) => domain)),
		new Set([
			'racers',
			'races',
			'trainer_results',
			'standings',
			'roster_history',
			'health',
			'wagers',
			'ledger'
		])
	);
	assert.ok(
		duplicateFindings.every(
			({ repairability, repair }) => repairability === 'review' && repair === null
		)
	);
});
