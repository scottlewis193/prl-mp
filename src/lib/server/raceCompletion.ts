import type { Racer } from '$lib/types';
import { orderRaceFinishers } from './raceSettlement';

export function shouldFinishRace(racers: Pick<Racer, 'currentRace'>[]) {
	return racers.length > 0 && racers.every((racer) => racer.currentRace.finished);
}

export function buildRaceCompletion(raceId: string, racers: Racer[]) {
	if (!shouldFinishRace(racers)) {
		throw new Error(`Cannot complete race ${raceId} before every participant finishes`);
	}
	const finishers = orderRaceFinishers(racers);
	const finishingOrder = finishers.map((racer) => racer.id as string);
	const winner = finishingOrder[0];
	if (!winner) throw new Error(`Cannot complete race ${raceId} without an identified winner`);
	const endTime = finishers[finishers.length - 1].currentRace.finishedAt;
	if (!endTime) throw new Error(`Cannot complete race ${raceId} without a finish time`);

	return { id: raceId, status: 'finished' as const, winner, endTime, finishingOrder };
}
