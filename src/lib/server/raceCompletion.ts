import type { Racer } from '$lib/types';
import { orderRaceFinishers } from './raceSettlement';

export function shouldFinishRace(racers: Pick<Racer, 'currentRace'>[]) {
	return racers.length > 0 && racers.every((racer) => racer.currentRace.finished);
}

export function buildRaceCompletion(raceId: string, racers: Racer[]) {
	if (!shouldFinishRace(racers)) {
		throw new Error(`Cannot complete race ${raceId} before every participant finishes`);
	}
	const finishers = orderRaceFinishers(
		racers.filter((racer) => racer.currentRace.outcome !== 'dnf')
	);
	const finishingOrder = finishers.map((racer) => racer.id as string);
	const winner = finishingOrder[0] ?? '';
	const terminalRacers = orderRaceFinishers(racers);
	const endTime = terminalRacers[terminalRacers.length - 1].currentRace.finishedAt;
	if (!endTime) throw new Error(`Cannot complete race ${raceId} without a finish time`);
	const nonFinishers = racers
		.filter((racer) => racer.currentRace.outcome === 'dnf')
		.sort((left, right) => (left.id ?? '').localeCompare(right.id ?? ''))
		.map((racer) => ({
			racerId: racer.id as string,
			occurredAt: racer.currentRace.incident?.occurredAt ?? racer.currentRace.finishedAt ?? endTime,
			reason: racer.currentRace.incident?.cause ?? 'incident',
			...(racer.currentRace.incident?.summary
				? { summary: racer.currentRace.incident.summary }
				: {})
		}));

	return {
		id: raceId,
		status: 'finished' as const,
		winner,
		endTime,
		finishingOrder,
		...(nonFinishers.length ? { nonFinishers } : {})
	};
}
