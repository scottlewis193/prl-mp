import type {
	IncidentInputs,
	RaceTrackType,
	Racer,
	RacerSuitabilityInputs,
	TrackCharacteristics,
	TrackSimulationContext
} from './types';
import { normalizeCompatibleFormats } from './raceFormat';

const clamp01 = (value: number | undefined) => Math.min(1, Math.max(0, Number(value) || 0));

export function getTrackCharacteristics(track: RaceTrackType): TrackCharacteristics {
	return {
		length: Number(track.length) || Number(track.totalLength) || 0,
		width: Number(track.width) || 0,
		surface: track.surface || 'asphalt',
		hazards: Array.isArray(track.hazards) ? track.hazards : [],
		corneringDemand: clamp01(track.corneringDemand),
		speedBias: Math.min(1, Math.max(-1, Number(track.speedBias) || 0)),
		risk: clamp01(track.risk),
		compatibleFormats: normalizeCompatibleFormats(track.compatibleFormats)
	};
}

export function createRacerSuitabilityInputs(
	racer: Racer,
	track: RaceTrackType
): RacerSuitabilityInputs {
	return {
		racerSpeed: (Number(racer.expand.pokemon?.speed) || 0) + (Number(racer.stats.speed) || 0),
		racerHandling: ((Number(racer.stats.attack) || 0) + (Number(racer.stats.defense) || 0)) / 2,
		track: getTrackCharacteristics(track)
	};
}

export function createIncidentInputs(racer: Racer, track: RaceTrackType): IncidentInputs {
	const characteristics = getTrackCharacteristics(track);
	return {
		racerResilience: ((Number(racer.stats.hp) || 0) + (Number(racer.stats.defense) || 0)) / 2,
		trackRisk: characteristics.risk,
		corneringDemand: characteristics.corneringDemand,
		hazards: characteristics.hazards
	};
}

function suitabilitySpeedMultiplier({
	racerSpeed,
	racerHandling,
	track: characteristics
}: RacerSuitabilityInputs): number {
	const speedFit = Math.min(1, racerSpeed / 200) - 0.5;
	const handlingFit = Math.min(1, racerHandling / 100) - 0.5;
	const adjustment =
		characteristics.speedBias * speedFit * 0.2 +
		characteristics.corneringDemand * handlingFit * 0.1;
	return Math.min(1.25, Math.max(0.75, 1 + adjustment));
}

export function createTrackSimulationContext(
	racer: Racer,
	track: RaceTrackType
): TrackSimulationContext {
	const suitability = createRacerSuitabilityInputs(racer, track);
	return {
		trackId: track.id,
		suitability,
		incident: createIncidentInputs(racer, track),
		speedMultiplier: suitabilitySpeedMultiplier(suitability)
	};
}
