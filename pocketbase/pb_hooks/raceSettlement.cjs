function orderRaceFinishers(participants) {
	return [...participants].sort((left, right) => {
		const finishTimeComparison = Date.parse(left.finishedAt) - Date.parse(right.finishedAt);
		return finishTimeComparison !== 0 ? finishTimeComparison : left.id.localeCompare(right.id);
	});
}

function buildRaceSettlement({ raceId, participants, prizeCurve }) {
	if (!raceId) throw new Error('Cannot settle a race without an ID');
	if (participants.length === 0) throw new Error(`Cannot settle race ${raceId} without racers`);
	if (
		!Array.isArray(prizeCurve) ||
		prizeCurve.length < participants.length ||
		prizeCurve.some((amount) => !Number.isFinite(amount) || amount < 0)
	) {
		throw new Error(`Race ${raceId} does not have a valid prize curve for every finisher`);
	}
	for (const racer of participants) {
		if (!racer.id || !racer.finished || !Number.isFinite(Date.parse(racer.finishedAt))) {
			throw new Error(`Race ${raceId} has a racer without a durable finish`);
		}
	}

	const finishers = orderRaceFinishers(participants);
	const completedAt = finishers[finishers.length - 1].finishedAt;
	const racers = finishers.map((racer, index) => {
		if (racer.raceHistory.races.some((result) => result.raceId === raceId)) {
			throw new Error(`Race ${raceId} is already present in racer ${racer.id} history`);
		}

		const position = index + 1;
		const prizeMoney = prizeCurve[index];
		const totalRaces = racer.raceHistory.totalRaces + 1;
		const averageFinishPosition =
			(racer.raceHistory.averageFinishPosition * racer.raceHistory.totalRaces + position) /
			totalRaces;
		const totalEarnings = racer.financials.totalEarnings + prizeMoney;

		return {
			id: racer.id,
			race: '',
			stats: { ...racer.stats },
			raceHistory: {
				wins: racer.raceHistory.wins + (position === 1 ? 1 : 0),
				totalRaces,
				averageFinishPosition,
				races: [...racer.raceHistory.races, { raceId, position, prizeMoney, date: completedAt }]
			},
			financials: {
				...racer.financials,
				totalEarnings,
				earningsPerShare: racer.totalShares > 0 ? totalEarnings / racer.totalShares : 0,
				lastPayoutAt: completedAt
			}
		};
	});

	return {
		race: {
			id: raceId,
			status: 'settled',
			winner: finishers[0].id,
			endTime: completedAt,
			finishingOrder: finishers.map((racer) => racer.id),
			awardedPrizes: finishers.map((racer, index) => ({
				racerId: racer.id,
				position: index + 1,
				amount: prizeCurve[index]
			}))
		},
		racers
	};
}

module.exports = { buildRaceSettlement, orderRaceFinishers };
