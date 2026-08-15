import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteTrade } from '../src/lib/exchangeTrade';

test('quoteTrade previews buy cost and sell proceeds from a whole share quantity', () => {
	assert.deepEqual(quoteTrade({ side: 'buy', quantity: 4, unitPrice: 12.5 }), {
		side: 'buy',
		quantity: 4,
		unitPrice: 12.5,
		total: 50
	});
	assert.deepEqual(quoteTrade({ side: 'sell', quantity: 3, unitPrice: 12.5 }), {
		side: 'sell',
		quantity: 3,
		unitPrice: 12.5,
		total: 37.5
	});
});

test('quoteTrade rejects invalid quantity and unavailable prices', () => {
	for (const quantity of [0, -1, 1.5, Number.NaN]) {
		assert.throws(
			() => quoteTrade({ side: 'buy', quantity, unitPrice: 10 }),
			/positive whole number/i
		);
	}
	for (const unitPrice of [0, -1, Number.NaN]) {
		assert.throws(() => quoteTrade({ side: 'sell', quantity: 1, unitPrice }), /tradable price/i);
	}
});

test('quoteTrade validates available cash, supply, and owned quantity', () => {
	assert.throws(
		() => quoteTrade({ side: 'buy', quantity: 6, unitPrice: 10, balance: 50, availableSupply: 10 }),
		/insufficient funds/i
	);
	assert.throws(
		() => quoteTrade({ side: 'buy', quantity: 6, unitPrice: 10, balance: 100, availableSupply: 5 }),
		/insufficient share supply/i
	);
	assert.throws(
		() => quoteTrade({ side: 'sell', quantity: 6, unitPrice: 10, ownedQuantity: 5 }),
		/insufficient holdings/i
	);
});
