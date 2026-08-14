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
	return [...racers].sort((left, right) => {
		const finishTimeComparison =
			Date.parse(left.currentRace.finishedAt ?? '') -
			Date.parse(right.currentRace.finishedAt ?? '');
		if (Number.isFinite(finishTimeComparison) && finishTimeComparison !== 0) {
			return finishTimeComparison;
		}

		return (left.id ?? '').localeCompare(right.id ?? '');
	});
}

export function buildRaceSettlement(
	race: Race,
	racers: Racer[],
	rewardScaleByLeague: Record<string, number>,
	settledAt: string
): RaceSettlement {
	if (!race.id) throw new Error('Cannot settle a race without an ID');
	const raceId = race.id;
	const finishers = orderRaceFinishers(racers);
	if (finishers.length === 0) throw new Error(`Cannot settle race ${raceId} without racers`);

	const settledRacers = finishers.map((racer, index) => {
		if (!racer.id || !racer.currentRace.finished || !racer.currentRace.finishedAt) {
			throw new Error(`Race ${raceId} has a racer without a durable finish`);
		}
		if (racer.raceHistory.races.some((result) => result.raceId === raceId)) {
			throw new Error(`Race ${raceId} is already present in racer ${racer.id} history`);
		}

		const position = index + 1;
		const rewardScale = Math.max(0, rewardScaleByLeague[racer.league] ?? 0);
		const prizeMoney = (finishers.length - index) * rewardScale;
		const totalRaces = racer.raceHistory.totalRaces + 1;
		const averageFinishPosition =
			(racer.raceHistory.averageFinishPosition * racer.raceHistory.totalRaces + position) /
			totalRaces;
		const totalEarnings = racer.financials.totalEarnings + prizeMoney;
		const totalShares = racer.ownership.totalShares;

		return {
			...racer,
			race: '',
			stats: { ...racer.stats, ranking: position },
			raceHistory: {
				wins: racer.raceHistory.wins + (position === 1 ? 1 : 0),
				totalRaces,
				averageFinishPosition,
				races: [...racer.raceHistory.races, { raceId, position, prizeMoney, date: settledAt }]
			},
			financials: {
				...racer.financials,
				totalEarnings,
				earningsPerShare: totalShares > 0 ? totalEarnings / totalShares : 0,
				lastPayoutAt: settledAt
			}
		};
	});

	return {
		race: {
			id: raceId,
			status: 'settled',
			winner: finishers[0].id as string,
			endTime: settledAt,
			finishingOrder: finishers.map((racer) => racer.id as string)
		},
		racers: settledRacers
	};
}
