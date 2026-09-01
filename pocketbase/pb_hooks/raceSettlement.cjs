function orderRaceFinishers(participants) {
	return [...participants].sort((left, right) => {
		const finishTimeComparison = Date.parse(left.finishedAt) - Date.parse(right.finishedAt);
		return finishTimeComparison !== 0 ? finishTimeComparison : left.id.localeCompare(right.id);
	});
}

function buildRaceSettlement({ raceId, participants, prizeCurve, classEntries = [] }) {
	if (!raceId) throw new Error('Cannot settle a race without an ID');
	if (participants.length === 0) throw new Error(`Cannot settle race ${raceId} without racers`);
	const classEntryByRacer = {};
	for (const entry of classEntries) {
		if (!entry?.racerId || !entry.classId || classEntryByRacer[entry.racerId]) {
			throw new Error(`Race ${raceId} has an invalid class entry snapshot`);
		}
		classEntryByRacer[entry.racerId] = entry;
	}
	const isClassRace = classEntries.length > 0;
	if (isClassRace && participants.some((participant) => !classEntryByRacer[participant.id])) {
		throw new Error(`Race ${raceId} does not have a class entry for every finisher`);
	}
	const requiredPrizePlaces = isClassRace
		? Object.values(
				participants.reduce((counts, participant) => {
					const classId = classEntryByRacer[participant.id].classId;
					counts[classId] = (counts[classId] || 0) + 1;
					return counts;
				}, {})
			).reduce((maximum, count) => Math.max(maximum, count), 0)
		: participants.length;
	if (
		!Array.isArray(prizeCurve) ||
		prizeCurve.length < requiredPrizePlaces ||
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
	const classCounts = {};
	const classResults = isClassRace
		? finishers.map((racer, index) => {
				const entry = classEntryByRacer[racer.id];
				classCounts[entry.classId] = (classCounts[entry.classId] || 0) + 1;
				return {
					racerId: racer.id,
					classId: entry.classId,
					className: entry.className || entry.classId,
					overallPosition: index + 1,
					classPosition: classCounts[entry.classId]
				};
			})
		: [];
	const classResultByRacer = {};
	for (const result of classResults) classResultByRacer[result.racerId] = result;
	const racers = finishers.map((racer, index) => {
		if (racer.raceHistory.races.some((result) => result.raceId === raceId)) {
			throw new Error(`Race ${raceId} is already present in racer ${racer.id} history`);
		}

		const position = index + 1;
		const classPosition = classResultByRacer[racer.id]?.classPosition;
		const prizeMoney = prizeCurve[(classPosition || position) - 1];
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
			...(isClassRace ? { classResults } : {}),
			awardedPrizes: finishers.map((racer, index) => ({
				racerId: racer.id,
				position: index + 1,
				...(classResultByRacer[racer.id]
					? { classPosition: classResultByRacer[racer.id].classPosition }
					: {}),
				amount: prizeCurve[(classResultByRacer[racer.id]?.classPosition || index + 1) - 1]
			}))
		},
		racers
	};
}

module.exports = { buildRaceSettlement, orderRaceFinishers };
