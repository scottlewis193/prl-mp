import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRaceIncident } from '../src/lib/server/raceIncidents';

const dangerousInput = {
	raceId: 'race-39',
	simulationSeed: 'incident-seed',
	now: Date.parse('2026-09-01T16:00:00.000Z'),
	racer: {
		id: 'racer-bolt',
		name: 'Bolt',
		traits: { durability: 0, resilience: 0, temperament: 100 },
		currentRace: { checkpointIndex: 3 }
	},
	track: {
		id: 'track-risky',
		risk: 1,
		corneringDemand: 1,
		hazards: [{ type: 'oil-slick', severity: 1, checkpointIndex: 3 }]
	},
	riskPolicy: { level: 'high' as const, incidentMultiplier: 2, trackRisk: 1 },
	raceFormat: { type: 'league_race' as const, ranked: true, rulesVersion: 'league-race-v1' }
};

test('track, format, health traits and a seed deterministically produce a durable DNF incident', () => {
	const incident = Array.from({ length: 100 }, (_, index) =>
		resolveRaceIncident({
			...dangerousInput,
			simulationSeed: `${dangerousInput.simulationSeed}-${index}`
		})
	).find((result) => result.outcome === 'dnf');

	assert.ok(incident);
	assert.deepEqual(
		resolveRaceIncident({
			...dangerousInput,
			simulationSeed: incident.decision.simulationSeed
		}),
		incident
	);
	assert.equal(incident.event?.type, 'incident_dnf');
	assert.equal(incident.event?.racerId, 'racer-bolt');
	assert.match(incident.event?.summary ?? '', /Bolt.*did not finish.*oil slick/i);
	assert.equal(incident.healthConsequence?.cause, 'race_incident');
	assert.equal(incident.healthConsequence?.eligible, false);
});

test('an incident decision is evaluated once per racer and checkpoint', () => {
	const previous = {
		lastIncidentDecisionKey: 'race-39:racer-bolt:0:3',
		checkpointIndex: 3
	};

	assert.equal(
		resolveRaceIncident({
			...dangerousInput,
			racer: { ...dangerousInput.racer, currentRace: previous }
		}).outcome,
		'none'
	);
});

test('an existing eligible health penalty increases the recorded incident probability', () => {
	const healthy = resolveRaceIncident({
		...dangerousInput,
		track: {
			...dangerousInput.track,
			risk: 0.2,
			corneringDemand: 0.2,
			hazards: [{ type: 'oil-slick', severity: 0.2, checkpointIndex: 3 }]
		},
		riskPolicy: { level: 'low', incidentMultiplier: 0.5, trackRisk: 0.2 },
		racer: {
			...dangerousInput.racer,
			traits: { durability: 50, resilience: 50, temperament: 50 },
			health: { eligible: true, performanceMultiplier: 1 }
		}
	});
	const impaired = resolveRaceIncident({
		...dangerousInput,
		track: {
			...dangerousInput.track,
			risk: 0.2,
			corneringDemand: 0.2,
			hazards: [{ type: 'oil-slick', severity: 0.2, checkpointIndex: 3 }]
		},
		riskPolicy: { level: 'low', incidentMultiplier: 0.5, trackRisk: 0.2 },
		racer: {
			...dangerousInput.racer,
			traits: { durability: 50, resilience: 50, temperament: 50 },
			health: { eligible: true, performanceMultiplier: 0.8 }
		}
	});

	assert.ok((impaired.decision.probability ?? 0) > (healthy.decision.probability ?? 0));
});
