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
		const quantity = Number(body.quantity);
		if (!racerId || !Number.isInteger(quantity) || quantity === 0) {
			throw e.badRequestError('A racer and a non-zero whole quantity are required.', {});
		}

		const result = { balance: 0, holding: { quantity: 0, costBasis: 0 } };
		e.app.runInTransaction((txApp) => {
			const player = txApp.findRecordById('users', e.auth.id);
			const racer = txApp.findRecordById('racers', racerId);
			const financials = new DynamicModel({ currentSharePrice: 0 });
			racer.unmarshalJSONField('financials', financials);
			const unitPrice = Number(financials.currentSharePrice);
			if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
				throw e.badRequestError('The racer does not have a tradable price.', {});
			}

			const isBuy = quantity > 0;
			const total = roundMoney(unitPrice * Math.abs(quantity));
			const balance = roundMoney(player.getFloat('balance'));
			if (isBuy && balance < total) throw e.badRequestError('Insufficient funds.', {});

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
			if (!isBuy && currentQuantity < Math.abs(quantity)) {
				throw e.badRequestError('Insufficient holdings.', {});
			}
			const balanceDelta = isBuy ? -total : total;
			const nextBalance = roundMoney(balance + balanceDelta);
			const nextQuantity = currentQuantity + quantity;
			const nextCostBasis = isBuy
				? roundMoney(holding.getFloat('costBasis') + total)
				: nextQuantity === 0
					? 0
					: roundMoney((holding.getFloat('costBasis') * nextQuantity) / currentQuantity);
			player.set('balance', nextBalance);
			holding.set('quantity', nextQuantity);
			holding.set('costBasis', nextCostBasis);
			txApp.save(player);
			txApp.save(holding);

			const entry = new Record(txApp.findCollectionByNameOrId('accountLedger'));
			entry.set('player', player.id);
			entry.set('racer', racer.id);
			entry.set('type', isBuy ? 'buy' : 'sell');
			entry.set('balanceDelta', balanceDelta);
			entry.set('balanceAfter', nextBalance);
			entry.set('quantityDelta', quantity);
			entry.set('quantityAfter', nextQuantity);
			entry.set('unitPrice', unitPrice);
			entry.set('costBasisAfter', nextCostBasis);
			entry.set('occurredAt', new Date().toISOString());
			txApp.save(entry);

			result.balance = nextBalance;
			result.holding = { quantity: nextQuantity, costBasis: nextCostBasis };
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
