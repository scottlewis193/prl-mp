import type {
	RaceMovePolicy,
	RaceMoveState,
	Racer,
	RaceSignificantEvent,
	RaceTrack,
	TrackSimulationContext
} from '$lib/types';
import { createTrackSimulationContext } from '../trackCharacteristics';
import { recordLapTime, startLapTimer } from './lapTiming';
import { performTemporaryRacingBuff } from './racingBuffs';

const collisionThreshold = 64; // collision radius
const MAX_ELAPSED_SECONDS = 1;

type RacerSimulationOptions = {
	raceId: string;
	simulationSeed: string;
	movePolicy: RaceMovePolicy;
	position: number;
	fieldSize: number;
};

export type SimulatedRacerProjection = {
	checkpointIndex: number;
	distanceFromCheckpoint: number;
	lapsCompleted: number;
	lastUpdatedAt: string;
	finished: boolean;
	finishedAt?: string;
	x: number;
	y: number;
	trackContext: TrackSimulationContext;
	moveState?: RaceMoveState;
	significantEvents?: RaceSignificantEvent[];
};

function appendSignificantEvents(
	existing: RaceSignificantEvent[] | undefined,
	created: RaceSignificantEvent[]
): RaceSignificantEvent[] {
	const events = new Map((existing ?? []).map((event) => [event.id, event]));
	for (const event of created) events.set(event.id, event);
	return [...events.values()]
		.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
		.slice(-100);
}

export function simulateRacer(
	racer: Racer,
	racetrack: RaceTrack,
	now = Date.now(),
	totalLaps = 10,
	options?: RacerSimulationOptions
): SimulatedRacerProjection {
	const lastUpdatedAt = Date.parse(racer.currentRace.lastUpdatedAt);
	const elapsed = Number.isFinite(lastUpdatedAt)
		? Math.min(MAX_ELAPSED_SECONDS, Math.max(0, (now - lastUpdatedAt) / 1000))
		: 0;
	const trackContext = createTrackSimulationContext(racer, racetrack);
	const buff = options
		? performTemporaryRacingBuff({
				racer,
				raceId: options.raceId,
				simulationSeed: options.simulationSeed,
				movePolicy: options.movePolicy,
				position: options.position,
				fieldSize: options.fieldSize,
				trackSegment: {
					checkpointIndex: racer.currentRace.checkpointIndex,
					speedBias: racetrack.speedBias,
					corneringDemand: racetrack.corneringDemand
				},
				now,
				state: racer.currentRace.moveState
			})
		: undefined;
	const moveProjection = buff
		? {
				moveState: buff.state,
				significantEvents: appendSignificantEvents(racer.currentRace.significantEvents, buff.events)
			}
		: {};

	// Determine current speed
	const pokemon = racer.expand.pokemon;
	if (!pokemon) {
		return {
			checkpointIndex: 0,
			distanceFromCheckpoint: 0,
			lapsCompleted: 0,
			lastUpdatedAt: new Date(now).toISOString(),
			finished: true,
			finishedAt: new Date(now).toISOString(),
			x: 0,
			y: 0,
			trackContext,
			...moveProjection
		};
	}
	const baseSpeed = racer.currentRace.finished
		? pokemon.speed / 7
		: pokemon.speed + racer.stats.speed;
	const healthMultiplier = racer.health?.eligible
		? Math.max(0, Math.min(1, racer.health.performanceMultiplier))
		: 1;
	const speed =
		baseSpeed *
		trackContext.speedMultiplier *
		healthMultiplier *
		(buff?.capabilityMultipliers.speed ?? 1);

	// Total distance to travel this tick
	let distanceToTravel = racer.currentRace.distanceFromCheckpoint + speed * elapsed;

	let checkpointIndex = racer.currentRace.checkpointIndex;
	let lapsCompleted = racer.currentRace.lapsCompleted;

	const checkpoints = racetrack.checkpoints;
	const trackWidth = racetrack.width || 64;

	// Move through segments as needed
	while (distanceToTravel > 0) {
		const a = checkpoints[checkpointIndex];
		const b = checkpoints[(checkpointIndex + 1) % Object.values(checkpoints).length];
		const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);

		// Still on current segment
		if (distanceToTravel < segmentLength) {
			break;
		}

		distanceToTravel -= segmentLength;
		checkpointIndex++;
		racer.stats.speed = Math.floor(Math.random() * 5);

		// Wrap checkpoints and count laps
		if (checkpointIndex >= Object.values(checkpoints).length - 1) {
			checkpointIndex = 0;
			lapsCompleted++;

			recordLapTime(racer, lapsCompleted);
			startLapTimer([racer]);

			if (lapsCompleted >= totalLaps) {
				const finishedAt = new Date(
					now - (speed > 0 ? (distanceToTravel / speed) * 1000 : 0)
				).toISOString();
				return {
					checkpointIndex: 0,
					distanceFromCheckpoint: 0,
					lapsCompleted,
					lastUpdatedAt: new Date(now).toISOString(),
					finished: true,
					finishedAt,
					x: checkpoints[0].x,
					y: checkpoints[0].y,
					trackContext,
					...moveProjection
				};
			}
		}
	}

	// Compute exact position on segment
	const a = checkpoints[checkpointIndex];
	const b = checkpoints[(checkpointIndex + 1) % Object.values(checkpoints).length];

	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const segmentLength = Math.hypot(dx, dy);
	const t = Math.min(distanceToTravel / segmentLength, 1);

	// Centerline position
	const cx = a.x + dx * t;
	const cy = a.y + dy * t;

	// Lane offset
	const nx = -dy / segmentLength;
	const ny = dx / segmentLength;
	const offset = ((racer.positioning.trackOffset ?? 0) * trackWidth) / 2;

	const x = cx + nx * offset;
	const y = cy + ny * offset;

	return {
		checkpointIndex,
		distanceFromCheckpoint: distanceToTravel,
		lapsCompleted,
		lastUpdatedAt: new Date(now).toISOString(),
		finished: false,
		x,
		y,
		trackContext,
		...moveProjection
	};
}
