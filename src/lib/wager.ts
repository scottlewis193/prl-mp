import wagerRules from '../../pocketbase/pb_hooks/wager.cjs';

export type WinnerMarket = ReturnType<typeof wagerRules.buildWinnerMarket>;
export type WagerQuote = ReturnType<typeof wagerRules.quoteWager>;

export const buildWinnerMarket = wagerRules.buildWinnerMarket;
export const quoteWager = wagerRules.quoteWager;
