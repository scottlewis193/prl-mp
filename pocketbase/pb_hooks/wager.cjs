function roundMoney(amount) {
	return Math.round(amount * 100) / 100;
}

function buildWinnerMarket(participants, cutoff) {
	if (!Number.isFinite(Date.parse(cutoff))) throw new Error('A valid betting cutoff is required.');
	if (!Array.isArray(participants) || participants.length < 2) {
		throw new Error('At least two racers are required for a winner market.');
	}
	const weighted = participants.map((participant) => {
		const ranking = Number(participant.ranking);
		if (!participant.racerId || !Number.isFinite(ranking) || ranking < 1) {
			throw new Error('Every market participant requires a racer and positive ranking.');
		}
		return { racerId: participant.racerId, weight: 1 / ranking };
	});
	const totalWeight = weighted.reduce((total, participant) => total + participant.weight, 0);

	return {
		type: 'winner',
		name: 'Race winner',
		cutoff: new Date(cutoff).toISOString(),
		selections: weighted.map((participant) => ({
			racerId: participant.racerId,
			odds: Math.max(1.01, roundMoney(totalWeight / participant.weight))
		}))
	};
}

function quoteWager({ market, selection, stake, now }) {
	if (!Number.isFinite(stake) || stake <= 0 || roundMoney(stake) !== stake) {
		throw new Error('Stake must be a positive amount in whole cents.');
	}
	const selected = market?.selections?.find((candidate) => candidate.racerId === selection);
	if (!selected || !Number.isFinite(selected.odds) || selected.odds < 1) {
		throw new Error('Choose an available selection.');
	}
	const placedAt = Date.parse(now);
	const cutoff = Date.parse(market.cutoff);
	if (!Number.isFinite(placedAt) || !Number.isFinite(cutoff)) {
		throw new Error('Valid placement and cutoff times are required.');
	}
	if (placedAt >= cutoff) throw new Error('Betting is closed for this race.');

	return {
		market: market.type,
		selection,
		stake: roundMoney(stake),
		odds: selected.odds,
		potentialPayout: roundMoney(stake * selected.odds)
	};
}

module.exports = { buildWinnerMarket, quoteWager, roundMoney };
