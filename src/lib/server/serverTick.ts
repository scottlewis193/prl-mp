import { randomUUID } from 'node:crypto';

import type { Race, Racer, RaceTrack } from '$lib/types';
import { mergeRaceSignificantEvents } from '$lib/raceMoveEvents';
import { buildRaceCompletion, shouldFinishRace } from './raceCompletion';
import { reconcileLeagueSchedule } from './leagueScheduler';
import { processRacerHealth } from './racerHealthProcessing';
import { processRacerRetirements } from './racerRetirementProcessing';
import { processTrainerRosters } from './rosterProcessing';
import { getRacers } from './racers';
import { getFinishedRaces, getRunningRaces, settleRace } from './races';
import { getAllRacetracks } from './racetracks';
import { resolveRacingAttacksForField } from './racingAttacks';
import { resolveRaceIncident } from './raceIncidents';
import { resolveOvertaking } from './serverFunctions';
import { simulateRacer } from './simulateRacer';
import { authenticateServer } from './pocketbase';
import {
	claimSimulatorLease,
	commitRaceSimulation,
	type RacerSimulationUpdate,
	type SimulatorLeaseGrant
} from './simulatorLease';

const SIM_INTERVAL_MS = 500;
const LEASE_TTL_MS = 5_000;
const LEASE_HEARTBEAT_MS = 1_000;
const ownerId = randomUUID();

let timer: ReturnType<typeof setInterval> | undefined;
let tickInProgress = false;

export async function startUp(): Promise<void> {
	if (timer) return;

	console.info('Background race simulator starting.', { ownerId });
	timer = setInterval(() => void runScheduledTick(), SIM_INTERVAL_MS);
	void runScheduledTick();
}

async function runScheduledTick(): Promise<void> {
	if (tickInProgress) return;
	tickInProgress = true;

	try {
		await serverTick();
	} catch (error) {
		console.error('Background race simulator tick failed.', { ownerId, error });
	} finally {
		tickInProgress = false;
	}
}

async function serverTick(): Promise<void> {
	await authenticateServer();
	let lease = await claimSimulatorLease(ownerId, LEASE_TTL_MS);
	if (!lease) return;
	try {
		const health = await processRacerHealth();
		if (health.createdConditions > 0 || health.recoveredConditions > 0) {
			console.info('Racer health processed.', { ownerId, ...health });
		}
	} catch (error) {
		console.error('Racer health processing failed.', { ownerId, error });
	}
	try {
		const retirement = await processRacerRetirements();
		if (retirement.retiredRacers > 0) {
			console.info('Racer retirements processed.', { ownerId, ...retirement });
		}
	} catch (error) {
		console.error('Racer retirement processing failed.', { ownerId, error });
	}
	try {
		const rosters = await processTrainerRosters();
		if (rosters.signedRacers || rosters.releasedRacers || rosters.createdFreeAgents) {
			console.info('Trainer rosters processed.', { ownerId, ...rosters });
		}
	} catch (error) {
		console.error('Trainer roster processing failed.', { ownerId, error });
	}
	lease = await claimSimulatorLease(ownerId, LEASE_TTL_MS);
	if (!lease) return;

	try {
		const schedule = await reconcileLeagueSchedule();
		if (schedule.createdEvents > 0 || schedule.transitionedRaces > 0) {
			console.info('League race schedule reconciled.', { ownerId, ...schedule });
		}
	} catch (error) {
		console.error('League race schedule reconciliation failed.', { ownerId, error });
	}

	lease = await claimSimulatorLease(ownerId, LEASE_TTL_MS);
	if (!lease) return;

	const [races, finishedRaces, racetracks] = await Promise.all([
		getRunningRaces(),
		getFinishedRaces(),
		getAllRacetracks()
	]);
	for (const race of finishedRaces) {
		if (!race.id) continue;
		try {
			await settleRace(race.id);
		} catch (error) {
			console.error('Background race settlement failed.', {
				ownerId,
				raceId: race.id,
				raceName: race.name,
				error
			});
		}
	}
	for (const race of races) {
		try {
			lease = await claimSimulatorLease(ownerId, LEASE_TTL_MS);
			if (!lease) {
				console.warn('Background race simulator lost ownership.', { ownerId, raceId: race.id });
				return;
			}

			await simulateRace(race, racetracks, lease);
		} catch (error) {
			console.error('Background race simulation failed for race.', {
				ownerId,
				raceId: race.id,
				raceName: race.name,
				error
			});
		}
	}
}

async function simulateRace(
	race: Race,
	racetracks: RaceTrack[],
	lease: SimulatorLeaseGrant
): Promise<void> {
	if (!race.id) throw new Error('Running race has no id');
	let heartbeatInProgress = false;
	let leaseLost = false;
	const heartbeat = setInterval(async () => {
		if (heartbeatInProgress || leaseLost) return;
		heartbeatInProgress = true;
		try {
			const renewed = await claimSimulatorLease(lease.ownerId, LEASE_TTL_MS);
			if (!renewed) leaseLost = true;
			else lease.token = renewed.token;
		} catch (error) {
			console.error('Background race simulator lease heartbeat failed.', {
				ownerId: lease.ownerId,
				raceId: race.id,
				error
			});
		} finally {
			heartbeatInProgress = false;
		}
	}, LEASE_HEARTBEAT_MS);

	try {
		const racers = await getRacers(race.id);
		const racetrack = racetracks.find((track) => track.id === race.racetrack);
		if (!racetrack || racetrack.checkpoints.length < 2) {
			throw new Error('Racetrack has fewer than two checkpoints');
		}

		const now = Date.now();
		const finishedAt = new Date(now).toISOString();
		const positions = new Map(
			[...racers]
				.sort((left, right) => {
					const lapDifference = right.currentRace.lapsCompleted - left.currentRace.lapsCompleted;
					if (lapDifference) return lapDifference;
					const checkpointDifference =
						right.currentRace.checkpointIndex - left.currentRace.checkpointIndex;
					if (checkpointDifference) return checkpointDifference;
					const distanceDifference =
						right.currentRace.distanceFromCheckpoint - left.currentRace.distanceFromCheckpoint;
					if (distanceDifference) return distanceDifference;
					return (left.id ?? '').localeCompare(right.id ?? '');
				})
				.map((racer, index) => [racer.id, index + 1])
		);
		const movePolicy = race.movePolicy ?? {
			enabled: false,
			rulesVersion: 'moves-disabled-v1'
		};
		const simulationSeed =
			race.movePolicy?.simulationSeed ?? `${race.id}:${movePolicy.rulesVersion}`;
		const attacks = resolveRacingAttacksForField({
			racers,
			positions: new Map(
				[...positions.entries()].filter((entry): entry is [string, number] => Boolean(entry[0]))
			),
			raceId: race.id,
			simulationSeed,
			movePolicy,
			trackSegment: {
				checkpointIndex: 0,
				speedBias: racetrack.speedBias,
				corneringDemand: racetrack.corneringDemand
			},
			now
		});
		for (const racer of racers) {
			if (!racer.id) continue;
			racer.currentRace.moveState = attacks.states[racer.id];
			const relevantEvents = attacks.events.filter(
				(event) => event.racerId === racer.id || event.targetRacerId === racer.id
			);
			if (relevantEvents.length > 0) {
				racer.currentRace.significantEvents = mergeRaceSignificantEvents(
					racer.currentRace.significantEvents,
					relevantEvents
				);
			}
		}
		for (const racer of racers) {
			if (racer.currentRace.finished) continue;
			const incident = resolveRaceIncident({
				raceId: race.id,
				simulationSeed,
				now,
				racer,
				track: racetrack,
				riskPolicy: race.riskPolicy ?? {
					level: 'standard',
					incidentMultiplier: 1,
					trackRisk: racetrack.risk
				},
				raceFormat: race.raceFormat ?? {
					type: 'league_race',
					ranked: true,
					rulesVersion: 'league-race-v1'
				}
			});
			racer.currentRace.lastIncidentDecisionKey = incident.decision.decisionKey;
			if (incident.event) {
				racer.currentRace.significantEvents = mergeRaceSignificantEvents(
					racer.currentRace.significantEvents,
					[incident.event]
				);
			}
			if (incident.outcome === 'dnf' && incident.incident && incident.healthConsequence) {
				racer.currentRace.finished = true;
				racer.currentRace.outcome = 'dnf';
				racer.currentRace.finishedAt = incident.incident.occurredAt;
				racer.currentRace.incident = incident.incident;
				racer.health = {
					eligible: incident.healthConsequence.eligible,
					performanceMultiplier: incident.healthConsequence.performanceMultiplier,
					activeConditionIds: [
						...new Set([...(racer.health?.activeConditionIds ?? []), incident.incident.eventId])
					]
				};
				racer.status = { ...racer.status, injured: true };
				continue;
			}
			const simulated = simulateRacer(racer, racetrack, now, race.totalLaps, {
				raceId: race.id,
				simulationSeed,
				movePolicy,
				position: positions.get(racer.id) ?? racers.length,
				fieldSize: racers.length
			});
			Object.assign(racer.currentRace, {
				checkpointIndex: simulated.checkpointIndex,
				distanceFromCheckpoint: simulated.distanceFromCheckpoint,
				lapsCompleted: simulated.lapsCompleted,
				lastUpdatedAt: simulated.lastUpdatedAt,
				trackContext: simulated.trackContext
			});
			if ('moveState' in simulated) racer.currentRace.moveState = simulated.moveState;
			if ('significantEvents' in simulated) {
				racer.currentRace.significantEvents = simulated.significantEvents;
			}
			racer.positioning.x = simulated.x;
			racer.positioning.y = simulated.y;
			racer.positioning.trackOffset = racer.positioning.targetTrackOffset ?? 0;

			if (simulated.finished && !racer.currentRace.finished) {
				racer.currentRace.finished = true;
				racer.currentRace.outcome = 'finished';
				racer.currentRace.finishedAt = simulated.finishedAt ?? finishedAt;
			}
		}

		resolveOvertaking(racers, now, race, racetrack);
		let raceUpdate;
		if (shouldFinishRace(racers)) {
			raceUpdate = buildRaceCompletion(race.id, racers);
			console.info('Race completion recorded.', {
				ownerId,
				raceId: race.id,
				winner: raceUpdate.winner,
				endTime: raceUpdate.endTime
			});
		}

		const renewed = await claimSimulatorLease(lease.ownerId, LEASE_TTL_MS);
		if (leaseLost || !renewed) return;
		lease.token = renewed.token;

		const racerUpdates = racers.map(toSimulationUpdate);
		const committed = await commitRaceSimulation(lease, racerUpdates, raceUpdate);
		if (!committed) {
			console.warn('Race simulation commit rejected because ownership changed.', {
				ownerId: lease.ownerId,
				raceId: race.id,
				leaseToken: lease.token
			});
		}
	} finally {
		clearInterval(heartbeat);
	}
}

function toSimulationUpdate(racer: Racer): RacerSimulationUpdate {
	if (!racer.id) throw new Error('Racer has no id');

	return {
		id: racer.id,
		currentRace: racer.currentRace,
		positioning: racer.positioning,
		stats: racer.stats,
		health: racer.health,
		status: racer.status
	};
}
