import settlementRules from '../../../pocketbase/pb_hooks/raceSettlement.cjs';

import type { Race, Racer } from '$lib/types';

export type RaceSettlement = {
	race: {
		id: string;
		status: 'settled';
		winner: string;
		endTime: string;
		finishingOrder: string[];
	};
	racers: Racer[];
};

export function orderRaceFinishers(racers: Racer[]): Racer[] {
	const racerById = new Map(racers.map((racer) => [racer.id, racer]));
	return settlementRules
		.orderRaceFinishers(
			racers.map((racer) => ({
				id: racer.id ?? '',
				finishedAt: racer.currentRace.finishedAt ?? ''
			}))
		)
		.map((participant) => racerById.get(participant.id) as Racer);
}

export function buildRaceSettlement(
	race: Race,
	racers: Racer[],
	rewardScaleByLeague: Record<string, number>
): RaceSettlement {
	const racerById = new Map(racers.map((racer) => [racer.id, racer]));
	const plan = settlementRules.buildRaceSettlement({
		raceId: race.id ?? '',
		participants: racers.map(toSettlementParticipant),
		rewardScaleByLeague
	});

	return {
		race: plan.race,
		racers: plan.racers.map(
			(update) =>
				({
					...(racerById.get(update.id) as Racer),
					...update
				}) as Racer
		)
	};
}

function toSettlementParticipant(racer: Racer) {
	return {
		id: racer.id ?? '',
		leagueId: racer.league,
		finished: racer.currentRace.finished,
		finishedAt: racer.currentRace.finishedAt ?? '',
		stats: racer.stats,
		raceHistory: racer.raceHistory,
		financials: racer.financials,
		totalShares: racer.ownership.totalShares
	};
}
