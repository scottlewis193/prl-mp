const { roundMoney } = require('./wager.cjs');

const WAGER_LEDGER_EVENTS = Object.freeze({
	reserve: Object.freeze({
		type: 'wager_reserve',
		reason: 'stake_reserved',
		sourceSuffix: 'reserve'
	}),
	payout: Object.freeze({
		type: 'wager_payout',
		reason: 'winning_wager_paid',
		sourceSuffix: 'payout'
	}),
	refund: Object.freeze({
		type: 'wager_refund',
		reason: 'voided_market_refund',
		sourceSuffix: 'refund'
	})
});

function recordWagerLedgerEntry(
	txApp,
	{ playerId, wagerId, eventKind, balanceDelta, balanceAfter, odds, occurredAt }
) {
	const event = WAGER_LEDGER_EVENTS[eventKind];
	if (!event) throw new Error('A supported wager ledger event kind is required.');
	const entry = new Record(txApp.findCollectionByNameOrId('accountLedger'));
	entry.set('player', playerId);
	entry.set('wager', wagerId);
	entry.set('type', event.type);
	entry.set('reason', event.reason);
	entry.set('sourceKey', `wager:${wagerId}:${event.sourceSuffix}`);
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
				eventKind: isRefund ? 'refund' : 'payout',
				balanceDelta: payout,
				balanceAfter: nextBalance,
				odds: wager.getFloat('odds'),
				occurredAt: resolvedAt
			});
		}
	}

	return resolvedCount;
}

function voidRace(
	txApp,
	{ raceId, resolvedAt, invalidStateError = (message) => new Error(message) }
) {
	const race = txApp.findRecordById('races', raceId);
	const status = race.getString('status');
	if (status === 'cancelled') return { voided: false, refundedWagers: 0 };
	if (status === 'settled') throw invalidStateError('Settled races cannot be voided.');

	const refundedWagers = resolveRaceWagers(txApp, { raceId, outcome: 'void', resolvedAt });
	race.set('status', 'cancelled');
	race.set('endTime', resolvedAt);
	txApp.save(race);
	return { voided: true, refundedWagers };
}

module.exports = { WAGER_LEDGER_EVENTS, recordWagerLedgerEntry, resolveRaceWagers, voidRace };
