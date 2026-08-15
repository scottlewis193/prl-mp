/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/prl/accounts/register', (e) => {
	const startingBalance = 10000;
	const body = e.requestInfo().body || {};
	const email = String(body.email || '')
		.trim()
		.toLowerCase();
	const password = String(body.password || '');
	const passwordConfirm = String(body.passwordConfirm || '');
	if (!email || !password || password !== passwordConfirm) {
		throw e.badRequestError('Valid matching account credentials are required.', {});
	}

	let userId = '';
	try {
		e.app.runInTransaction((txApp) => {
			const user = new Record(txApp.findCollectionByNameOrId('users'));
			user.set('email', email);
			user.set('password', password);
			user.set('passwordConfirm', passwordConfirm);
			user.set('verified', false);
			user.set('options', body.options || {});
			user.set('watchlist', body.watchlist || []);
			user.set('balance', startingBalance);
			txApp.save(user);
			userId = user.id;

			const entry = new Record(txApp.findCollectionByNameOrId('accountLedger'));
			entry.set('player', user.id);
			entry.set('type', 'account_opened');
			entry.set('balanceDelta', startingBalance);
			entry.set('balanceAfter', startingBalance);
			entry.set('quantityDelta', 0);
			entry.set('quantityAfter', 0);
			entry.set('unitPrice', 0);
			entry.set('costBasisAfter', 0);
			entry.set('occurredAt', new Date().toISOString());
			txApp.save(entry);
		});
	} catch (error) {
		e.app.logger().error('Account registration transaction failed', 'error', String(error));
		throw error;
	}

	return e.json(201, { id: userId });
});

routerAdd(
	'POST',
	'/api/prl/economy/trade',
	(e) => {
		const roundMoney = (amount) => Math.round(amount * 100) / 100;
		const body = e.requestInfo().body || {};
		const racerId = String(body.racerId || '');
		const side = String(body.side || '');
		const quantity = Number(body.quantity);
		const expectedUnitPrice = Number(body.expectedUnitPrice);
		const idempotencyKey = String(body.idempotencyKey || '').trim();
		if (
			!racerId ||
			(side !== 'buy' && side !== 'sell') ||
			!Number.isInteger(quantity) ||
			quantity <= 0
		) {
			throw e.badRequestError('A racer, trade side, and positive whole quantity are required.', {});
		}
		if (!idempotencyKey || idempotencyKey.length > 100) {
			throw e.badRequestError('A valid idempotency key is required.', {});
		}
		if (!Number.isFinite(expectedUnitPrice) || expectedUnitPrice <= 0) {
			throw e.badRequestError('A valid expected unit price is required.', {});
		}

		const result = {
			balance: 0,
			holding: { quantity: 0, costBasis: 0 },
			availableSupply: 0
		};
		e.app.runInTransaction((txApp) => {
			const player = txApp.findRecordById('users', e.auth.id);
			let previousEntry = null;
			try {
				previousEntry = txApp.findFirstRecordByFilter(
					'accountLedger',
					'player = {:playerId} && idempotencyKey = {:idempotencyKey}',
					{ playerId: player.id, idempotencyKey }
				);
			} catch {
				// No prior request has committed with this key.
			}
			if (previousEntry) {
				const previousSide = previousEntry.getString('type');
				const previousQuantity = Math.abs(previousEntry.getInt('quantityDelta'));
				if (
					previousEntry.getString('racer') !== racerId ||
					previousSide !== side ||
					previousQuantity !== quantity ||
					roundMoney(previousEntry.getFloat('unitPrice')) !== roundMoney(expectedUnitPrice)
				) {
					throw e.badRequestError('The idempotency key was already used for another trade.', {});
				}
				result.balance = previousEntry.getFloat('balanceAfter');
				result.holding = {
					quantity: previousEntry.getInt('quantityAfter'),
					costBasis: previousEntry.getFloat('costBasisAfter')
				};
				result.availableSupply = previousEntry.getInt('availableSupplyAfter');
				return;
			}

			const racer = txApp.findRecordById('racers', racerId);
			const financials = new DynamicModel({
				totalEarnings: 0,
				earningsPerShare: 0,
				lastPayoutAt: '',
				issuedShares: 0,
				outstandingShares: 0,
				currentSharePrice: 0,
				priceHistory: []
			});
			racer.unmarshalJSONField('financials', financials);
			const unitPrice = Number(financials.currentSharePrice);
			if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
				throw e.badRequestError('The racer does not have a tradable price.', {});
			}
			if (roundMoney(unitPrice) !== roundMoney(expectedUnitPrice)) {
				throw e.badRequestError('The share price changed. Review the updated quote.', {});
			}

			const isBuy = side === 'buy';
			const total = roundMoney(unitPrice * quantity);
			const balance = roundMoney(player.getFloat('balance'));
			if (isBuy && balance < total) throw e.badRequestError('Insufficient funds.', {});
			const availableSupply = Number(financials.outstandingShares);
			if (!Number.isInteger(availableSupply) || availableSupply < 0) {
				throw e.badRequestError('The racer does not have valid share supply.', {});
			}
			if (isBuy && availableSupply < quantity) {
				throw e.badRequestError('Insufficient share supply.', {});
			}

			let holding;
			try {
				holding = txApp.findFirstRecordByFilter(
					'holdings',
					'player = {:playerId} && racer = {:racerId}',
					{ playerId: player.id, racerId }
				);
			} catch {
				if (!isBuy) throw e.badRequestError('Insufficient holdings.', {});
				holding = new Record(txApp.findCollectionByNameOrId('holdings'));
				holding.set('player', player.id);
				holding.set('racer', racer.id);
			}

			const currentQuantity = holding.getInt('quantity');
			if (!isBuy && currentQuantity < quantity) {
				throw e.badRequestError('Insufficient holdings.', {});
			}
			const balanceDelta = isBuy ? -total : total;
			const nextBalance = roundMoney(balance + balanceDelta);
			const quantityDelta = isBuy ? quantity : -quantity;
			const nextQuantity = currentQuantity + quantityDelta;
			const nextAvailableSupply = availableSupply - quantityDelta;
			const nextCostBasis = isBuy
				? roundMoney(holding.getFloat('costBasis') + total)
				: nextQuantity === 0
					? 0
					: roundMoney((holding.getFloat('costBasis') * nextQuantity) / currentQuantity);
			player.set('balance', nextBalance);
			holding.set('quantity', nextQuantity);
			holding.set('costBasis', nextCostBasis);
			racer.set('financials', {
				totalEarnings: financials.totalEarnings,
				earningsPerShare: financials.earningsPerShare,
				lastPayoutAt: financials.lastPayoutAt,
				issuedShares: financials.issuedShares,
				outstandingShares: nextAvailableSupply,
				currentSharePrice: financials.currentSharePrice,
				priceHistory: financials.priceHistory
			});
			txApp.save(player);
			txApp.save(holding);
			txApp.save(racer);

			const entry = new Record(txApp.findCollectionByNameOrId('accountLedger'));
			entry.set('player', player.id);
			entry.set('racer', racer.id);
			entry.set('type', side);
			entry.set('balanceDelta', balanceDelta);
			entry.set('balanceAfter', nextBalance);
			entry.set('quantityDelta', quantityDelta);
			entry.set('quantityAfter', nextQuantity);
			entry.set('unitPrice', unitPrice);
			entry.set('costBasisAfter', nextCostBasis);
			entry.set('idempotencyKey', idempotencyKey);
			entry.set('availableSupplyAfter', nextAvailableSupply);
			entry.set('occurredAt', new Date().toISOString());
			txApp.save(entry);

			result.balance = nextBalance;
			result.holding = { quantity: nextQuantity, costBasis: nextCostBasis };
			result.availableSupply = nextAvailableSupply;
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
