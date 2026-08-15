/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/wagers/place',
	(e) => {
		const wagerResponse = (wager, balance) => ({
			id: wager.id,
			status: wager.getString('status'),
			balance,
			stake: wager.getFloat('stake'),
			odds: wager.getFloat('odds'),
			potentialPayout: wager.getFloat('potentialPayout')
		});
		const body = e.requestInfo().body || {};
		const raceId = String(body.raceId || '').trim();
		const marketType = String(body.market || '').trim();
		const selection = String(body.selection || '').trim();
		const stake = Number(body.stake);
		const idempotencyKey = String(body.idempotencyKey || '').trim();
		if (!raceId || marketType !== 'winner' || !selection) {
			throw e.badRequestError('A race, supported market, and selection are required.', {});
		}
		if (!idempotencyKey || idempotencyKey.length > 100) {
			throw e.badRequestError('A valid idempotency key is required.', {});
		}

		let result;
		e.app.runInTransaction((txApp) => {
			let previous;
			try {
				previous = txApp.findFirstRecordByFilter(
					'wagers',
					'player = {:playerId} && idempotencyKey = {:idempotencyKey}',
					{ playerId: e.auth.id, idempotencyKey }
				);
			} catch {
				// No committed wager uses this request key.
			}
			if (previous) {
				if (
					previous.getString('race') !== raceId ||
					previous.getString('market') !== marketType ||
					previous.getString('selection') !== selection ||
					previous.getFloat('stake') !== stake
				) {
					throw e.badRequestError('The idempotency key was already used for another wager.', {});
				}
				const player = txApp.findRecordById('users', e.auth.id);
				result = wagerResponse(previous, player.getFloat('balance'));
				return;
			}

			const race = txApp.findRecordById('races', raceId);
			if (!['pending', 'countdown'].includes(race.getString('status'))) {
				throw e.badRequestError('Betting is closed for this race.', {});
			}
			const bettingCutoff = Date.parse(race.getDateTime('bettingCutoff').string());
			if (!Number.isFinite(bettingCutoff) || Date.now() >= bettingCutoff) {
				throw e.badRequestError('Betting is closed for this race.', {});
			}
			const marketBook = new DynamicModel({
				winnerType: '',
				winnerName: '',
				winnerCutoff: '',
				winnerSelections: []
			});
			race.unmarshalJSONField('markets', marketBook);
			if (marketBook.winnerType !== 'winner') {
				throw e.badRequestError('The requested market is unavailable.', {});
			}
			const market = {
				type: marketBook.winnerType,
				name: marketBook.winnerName,
				cutoff: marketBook.winnerCutoff,
				selections: Array.from(marketBook.winnerSelections || []).map((candidate) => ({
					racerId: String(candidate.racerId || ''),
					odds: Number(candidate.odds)
				}))
			};
			let quote;
			try {
				quote = require(`${__hooks}/wager.cjs`).quoteWager({
					market,
					selection,
					stake,
					now: new Date().toISOString()
				});
			} catch (error) {
				throw e.badRequestError(error.message, {});
			}

			const player = txApp.findRecordById('users', e.auth.id);
			const balance = require(`${__hooks}/wager.cjs`).roundMoney(player.getFloat('balance'));
			if (balance < quote.stake) throw e.badRequestError('Insufficient funds.', {});
			const nextBalance = require(`${__hooks}/wager.cjs`).roundMoney(balance - quote.stake);
			player.set('balance', nextBalance);
			txApp.save(player);

			const wager = new Record(txApp.findCollectionByNameOrId('wagers'));
			wager.set('player', player.id);
			wager.set('race', race.id);
			wager.set('market', quote.market);
			wager.set('selection', quote.selection);
			wager.set('stake', quote.stake);
			wager.set('odds', quote.odds);
			wager.set('potentialPayout', quote.potentialPayout);
			wager.set('status', 'open');
			wager.set('payout', 0);
			wager.set('idempotencyKey', idempotencyKey);
			wager.set('placedAt', new Date().toISOString());
			txApp.save(wager);

			require(`${__hooks}/wagerSettlement.cjs`).recordWagerLedgerEntry(txApp, {
				playerId: player.id,
				wagerId: wager.id,
				type: 'wager_reserve',
				balanceDelta: -quote.stake,
				balanceAfter: nextBalance,
				odds: quote.odds,
				occurredAt: new Date().toISOString()
			});
			result = wagerResponse(wager, nextBalance);
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
