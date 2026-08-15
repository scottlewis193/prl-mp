export type TradeSide = 'buy' | 'sell';

export type TradeQuote = {
	side: TradeSide;
	quantity: number;
	unitPrice: number;
	total: number;
};

export type TradeOrder = {
	side: TradeSide;
	quantity: number;
	idempotencyKey: string;
	expectedUnitPrice: number;
};

export type TradeHolding = {
	quantity: number;
	costBasis: number;
};

export type TradeResult = {
	balance: number;
	holding: TradeHolding;
	availableSupply: number;
};

type QuoteTradeInput = {
	side: TradeSide;
	quantity: number;
	unitPrice: number;
	balance?: number;
	availableSupply?: number;
	ownedQuantity?: number;
};

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

export function quoteTrade(input: QuoteTradeInput): TradeQuote {
	if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
		throw new Error('Quantity must be a positive whole number.');
	}
	if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
		throw new Error('The racer does not have a tradable price.');
	}

	const total = roundMoney(input.quantity * input.unitPrice);
	if (input.side === 'buy') {
		if (input.balance !== undefined && input.balance < total) {
			throw new Error('Insufficient funds.');
		}
		if (input.availableSupply !== undefined && input.availableSupply < input.quantity) {
			throw new Error('Insufficient share supply.');
		}
	} else if (input.ownedQuantity !== undefined && input.ownedQuantity < input.quantity) {
		throw new Error('Insufficient holdings.');
	}

	return {
		side: input.side,
		quantity: input.quantity,
		unitPrice: input.unitPrice,
		total
	};
}
