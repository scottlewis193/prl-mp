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
			potentialPayout: wager.getFloat('potentialPayout'),
			cutoffAt: wager.getDateTime('cutoffAt').string(),
			cutoffSnapshotStatus: wager.getString('cutoffSnapshotStatus')
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
				const reserve = txApp.findFirstRecordByFilter(
					'accountLedger',
					'player = {:playerId} && sourceKey = {:sourceKey}',
					{ playerId: e.auth.id, sourceKey: `wager:${previous.id}:reserve` }
				);
				result = wagerResponse(previous, reserve.getFloat('balanceAfter'));
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
			if (Date.parse(market.cutoff) !== bettingCutoff) {
				throw e.badRequestError('The requested market is unavailable.', {});
			}
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
			let selectedRacer;
			try {
				selectedRacer = txApp.findRecordById('racers', quote.selection);
			} catch {
				throw e.badRequestError('The selected racer is not participating in this race.', {});
			}
			if (selectedRacer.getString('race') !== race.id) {
				throw e.badRequestError('The selected racer is not participating in this race.', {});
			}

			const player = txApp.findRecordById('users', e.auth.id);
			const balance = require(`${__hooks}/wager.cjs`).roundMoney(player.getFloat('balance'));
			if (balance < quote.stake) throw e.badRequestError('Insufficient funds.', {});
			const nextBalance = require(`${__hooks}/wager.cjs`).roundMoney(balance - quote.stake);
			player.set('balance', nextBalance);
			txApp.save(player);

			const acceptedAt = new Date().toISOString();
			const wager = new Record(txApp.findCollectionByNameOrId('wagers'));
			wager.set('player', player.id);
			wager.set('race', race.id);
			wager.set('market', quote.market);
			wager.set('selection', quote.selection);
			wager.set('stake', quote.stake);
			wager.set('odds', quote.odds);
			wager.set('potentialPayout', quote.potentialPayout);
			wager.set('cutoffAt', quote.cutoffAt);
			wager.set('cutoffSnapshotStatus', 'accepted');
			wager.set('status', 'open');
			wager.set('payout', 0);
			wager.set('idempotencyKey', idempotencyKey);
			wager.set('placedAt', acceptedAt);
			txApp.save(wager);

			require(`${__hooks}/wagerSettlement.cjs`).recordWagerLedgerEntry(txApp, {
				playerId: player.id,
				wagerId: wager.id,
				eventKind: 'reserve',
				balanceDelta: -quote.stake,
				balanceAfter: nextBalance,
				odds: quote.odds,
				occurredAt: acceptedAt
			});
			result = wagerResponse(wager, nextBalance);
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);

routerAdd(
	'GET',
	'/api/prl/wagers/account',
	(e) => {
		const roundMoney = require(`${__hooks}/wager.cjs`).roundMoney;
		const findAllInSnapshot = (txApp, collection, filter, sort, params) => {
			const pageSize = 1000;
			const records = [];
			for (let offset = 0; ; offset += pageSize) {
				const page = txApp.findRecordsByFilter(collection, filter, sort, pageSize, offset, params);
				records.push(...page);
				if (page.length < pageSize) return records;
			}
		};
		let result;
		e.app.runInTransaction((txApp) => {
			const player = txApp.findRecordById('users', e.auth.id);
			const ledger = findAllInSnapshot(
				txApp,
				'accountLedger',
				'player = {:playerId}',
				'occurredAt,id',
				{ playerId: e.auth.id }
			);
			const wagers = findAllInSnapshot(txApp, 'wagers', 'player = {:playerId}', '-placedAt,-id', {
				playerId: e.auth.id
			});
			const raceNameById = {};
			const selectionNameById = {};
			const projectedWagers = wagers.map((wager) => {
				const raceId = wager.getString('race');
				const selectionId = wager.getString('selection');
				if (raceNameById[raceId] === undefined) {
					raceNameById[raceId] = txApp.findRecordById('races', raceId).getString('name');
				}
				if (selectionNameById[selectionId] === undefined) {
					selectionNameById[selectionId] = txApp
						.findRecordById('racers', selectionId)
						.getString('name');
				}
				return {
					id: wager.id,
					raceId,
					raceName: raceNameById[raceId],
					market: wager.getString('market'),
					selection: selectionId,
					selectionName: selectionNameById[selectionId],
					stake: wager.getFloat('stake'),
					odds: wager.getFloat('odds'),
					potentialPayout: wager.getFloat('potentialPayout'),
					cutoffAt: wager.getDateTime('cutoffAt').string(),
					cutoffSnapshotStatus: wager.getString('cutoffSnapshotStatus'),
					placedAt: wager.getDateTime('placedAt').string(),
					status: wager.getString('status'),
					payout: wager.getFloat('payout'),
					resolvedAt: wager.getDateTime('resolvedAt').string()
				};
			});
			const balance = roundMoney(player.getFloat('balance'));
			const ledgerBalance = roundMoney(
				ledger.reduce((total, entry) => total + entry.getFloat('balanceDelta'), 0)
			);
			result = {
				balance,
				ledgerBalance,
				reconciled: balance === ledgerBalance,
				openWagers: projectedWagers.filter((wager) => wager.status === 'open'),
				historicalWagers: projectedWagers.filter((wager) => wager.status !== 'open')
			};
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
