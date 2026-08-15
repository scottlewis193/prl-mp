const { roundMoney } = require('./wager.cjs');

function recordWagerLedgerEntry(
	txApp,
	{ playerId, wagerId, type, balanceDelta, balanceAfter, odds, occurredAt }
) {
	const entry = new Record(txApp.findCollectionByNameOrId('accountLedger'));
	entry.set('player', playerId);
	entry.set('wager', wagerId);
	entry.set('type', type);
	entry.set('balanceDelta', balanceDelta);
	entry.set('balanceAfter', balanceAfter);
	entry.set('quantityDelta', 0);
	entry.set('quantityAfter', 0);
	entry.set('unitPrice', odds);
	entry.set('costBasisAfter', 0);
	entry.set('occurredAt', occurredAt);
	txApp.save(entry);
}

function resolveRaceWagers(txApp, { raceId, outcome, winnerId = '', resolvedAt }) {
	if (outcome !== 'settled' && outcome !== 'void') {
		throw new Error('A settled or void wagering outcome is required.');
	}
	let resolvedCount = 0;
	while (true) {
		const wagers = txApp.findRecordsByFilter(
			'wagers',
			'race = {:raceId} && status = "open"',
			'id',
			1000,
			0,
			{ raceId }
		);
		if (wagers.length === 0) break;
		resolvedCount += wagers.length;
		for (const wager of wagers) {
			const isRefund = outcome === 'void';
			const isWinner = outcome === 'settled' && wager.getString('selection') === winnerId;
			const payout = isRefund
				? wager.getFloat('stake')
				: isWinner
					? wager.getFloat('potentialPayout')
					: 0;
			wager.set('status', isRefund ? 'refunded' : isWinner ? 'won' : 'lost');
			wager.set('payout', payout);
			wager.set('resolvedAt', resolvedAt);
			txApp.save(wager);

			if (payout === 0) continue;
			const player = txApp.findRecordById('users', wager.getString('player'));
			const nextBalance = roundMoney(player.getFloat('balance') + payout);
			player.set('balance', nextBalance);
			txApp.save(player);

			recordWagerLedgerEntry(txApp, {
				playerId: player.id,
				wagerId: wager.id,
				type: isRefund ? 'wager_refund' : 'wager_payout',
				balanceDelta: payout,
				balanceAfter: nextBalance,
				odds: wager.getFloat('odds'),
				occurredAt: resolvedAt
			});
		}
	}

	return resolvedCount;
}

module.exports = { recordWagerLedgerEntry, resolveRaceWagers };
