const RECENT_FORM_LIMIT = 5;

function applyLeagueRaceResult(standing, result) {
	const position = Number(result.position);
	const points = Number(result.points);
	if (!Number.isInteger(position) || position < 1) {
		throw new Error('A league result requires a positive finishing position');
	}
	if (!Number.isFinite(points) || points < 0) {
		throw new Error('A league result requires non-negative points');
	}

	const previousBest = Number(standing.bestFinish) || 0;
	return {
		...standing,
		points: (Number(standing.points) || 0) + points,
		starts: (Number(standing.starts) || 0) + 1,
		wins: (Number(standing.wins) || 0) + (position === 1 ? 1 : 0),
		podiums: (Number(standing.podiums) || 0) + (position <= 3 ? 1 : 0),
		bestFinish: previousBest === 0 ? position : Math.min(previousBest, position),
		recentForm: [
			position,
			...(Array.isArray(standing.recentForm) ? standing.recentForm : [])
		].slice(0, RECENT_FORM_LIMIT)
	};
}

function orderLeagueStandings(standings) {
	return [...standings].sort((left, right) => {
		return (
			Number(right.points) - Number(left.points) ||
			Number(right.wins) - Number(left.wins) ||
			Number(right.podiums) - Number(left.podiums) ||
			compareBestFinish(left.bestFinish, right.bestFinish) ||
			String(left.racerId).localeCompare(String(right.racerId))
		);
	});
}

function pointsForRaceSettlement(raceFormat, pointsCurve, finisherCount) {
	if (!raceFormat || raceFormat.type !== 'league_race' || raceFormat.ranked !== true) return null;
	if (
		!Number.isInteger(finisherCount) ||
		finisherCount < 1 ||
		!Array.isArray(pointsCurve) ||
		pointsCurve.length < finisherCount ||
		pointsCurve.some((points) => !Number.isFinite(Number(points)) || Number(points) < 0)
	) {
		throw new Error('The ranked League Race points curve is invalid');
	}
	return pointsCurve.slice(0, finisherCount).map(Number);
}

function compareBestFinish(left, right) {
	const normalizedLeft = Number(left) > 0 ? Number(left) : Number.POSITIVE_INFINITY;
	const normalizedRight = Number(right) > 0 ? Number(right) : Number.POSITIVE_INFINITY;
	return normalizedLeft - normalizedRight;
}

module.exports = { applyLeagueRaceResult, orderLeagueStandings, pointsForRaceSettlement };
