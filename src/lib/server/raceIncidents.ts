import type {
	RaceCompetitionFormat,
	RaceIncident,
	RaceRiskPolicy,
	RaceSignificantEvent,
	RacerTraits
} from '$lib/types';

type IncidentRacer = {
	id?: string;
	name: string;
	traits?: Partial<RacerTraits>;
	health?: { eligible: boolean; performanceMultiplier: number };
	currentRace: {
		checkpointIndex: number;
		lapsCompleted?: number;
		lastIncidentDecisionKey?: string;
	};
};

type IncidentTrack = {
	id?: string;
	risk: number;
	corneringDemand: number;
	hazards: { type: string; severity: number; checkpointIndex?: number }[];
};

export type RaceIncidentInput = {
	raceId: string;
	simulationSeed: string;
	now: number;
	racer: IncidentRacer;
	track: IncidentTrack;
	riskPolicy: RaceRiskPolicy;
	raceFormat: RaceCompetitionFormat;
};

export type RaceIncidentResult = {
	outcome: 'none' | 'incident' | 'dnf';
	decision: {
		decisionKey: string;
		simulationSeed: string;
		roll?: number;
		probability?: number;
	};
	event?: RaceSignificantEvent;
	incident?: RaceIncident;
	healthConsequence?: {
		cause: 'race_incident';
		severity: 'moderate' | 'severe';
		eligible: false;
		performanceMultiplier: 0;
	};
};

function clamp(value: number, minimum = 0, maximum = 1): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function seededUnitInterval(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0x1_0000_0000;
}

function formatMultiplier(format: RaceCompetitionFormat['type']): number {
	if (format === 'grand_prix') return 1.15;
	if (format === 'exhibition' || format === 'legends_exhibition') return 0.6;
	return 1;
}

function causeLabel(cause: string): string {
	return cause.replaceAll('-', ' ');
}

export function resolveRaceIncident(input: RaceIncidentInput): RaceIncidentResult {
	const racerId = input.racer.id ?? 'unknown-racer';
	const checkpointIndex = input.racer.currentRace.checkpointIndex;
	const decisionKey = `${input.raceId}:${racerId}:${input.racer.currentRace.lapsCompleted ?? 0}:${checkpointIndex}`;
	const decision = { decisionKey, simulationSeed: input.simulationSeed };
	if (input.racer.currentRace.lastIncidentDecisionKey === decisionKey) {
		return { outcome: 'none', decision };
	}

	const hazard = [...(input.track.hazards ?? [])]
		.filter(
			(candidate) =>
				candidate.checkpointIndex === undefined || candidate.checkpointIndex === checkpointIndex
		)
		.sort(
			(left, right) => right.severity - left.severity || left.type.localeCompare(right.type)
		)[0];
	const traits = input.racer.traits ?? {};
	const traitVulnerability =
		((100 - clamp(Number(traits.durability ?? 50), 0, 100)) / 100) * 0.45 +
		((100 - clamp(Number(traits.resilience ?? 50), 0, 100)) / 100) * 0.35 +
		(clamp(Number(traits.temperament ?? 50), 0, 100) / 100) * 0.2;
	const healthVulnerability = input.racer.health?.eligible
		? 1 - clamp(Number(input.racer.health.performanceMultiplier))
		: input.racer.health
			? 1
			: 0;
	const vulnerability = clamp(traitVulnerability + healthVulnerability * 0.2);
	const environmentalRisk =
		clamp((Number(input.track.risk) + Number(input.riskPolicy.trackRisk)) / 2) * 0.45 +
		clamp(Number(input.track.corneringDemand)) * 0.2 +
		clamp(Number(hazard?.severity ?? 0)) * 0.35;
	const probability = clamp(
		0.0025 +
			environmentalRisk *
				vulnerability *
				clamp(Number(input.riskPolicy.incidentMultiplier), 0, 3) *
				formatMultiplier(input.raceFormat.type),
		0,
		0.35
	);
	const roll = seededUnitInterval(`${input.simulationSeed}:${decisionKey}:incident`);
	const decided = { ...decision, roll, probability };
	if (roll >= probability) return { outcome: 'none', decision: decided };

	const dnf = seededUnitInterval(`${input.simulationSeed}:${decisionKey}:severity`) < 0.35;
	const cause =
		hazard?.type ?? (input.track.corneringDemand >= 0.6 ? 'loss-of-control' : 'mechanical-failure');
	const occurredAt = new Date(input.now).toISOString();
	const type = cause === 'mechanical-failure' ? 'mechanical' : 'crash';
	const summary = dnf
		? `${input.racer.name} did not finish after a ${causeLabel(cause)} ${type}.`
		: `${input.racer.name} recovered from a ${causeLabel(cause)} incident.`;
	const event: RaceSignificantEvent = {
		id: `${decisionKey}:${dnf ? 'dnf' : 'incident'}`,
		type: dnf ? 'incident_dnf' : 'incident',
		occurredAt,
		racerId,
		racerName: input.racer.name,
		summary
	};
	if (!dnf) return { outcome: 'incident', decision: decided, event };

	const healthSeverity = hazard && hazard.severity >= 0.75 ? 'severe' : 'moderate';
	return {
		outcome: 'dnf',
		decision: decided,
		event,
		incident: {
			eventId: event.id,
			type,
			cause,
			summary,
			occurredAt,
			healthSeverity,
			decisionRoll: roll,
			probability,
			rulesVersion: 'race-incidents-v1'
		},
		healthConsequence: {
			cause: 'race_incident',
			severity: healthSeverity,
			eligible: false,
			performanceMultiplier: 0
		}
	};
}
