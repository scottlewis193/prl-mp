import type { ExchangePage, Holding } from '$lib/types';
import { getContext, setContext } from 'svelte';

const exchangePageKey = Symbol('exchangePage');

export function getExchangePageContext(): ExchangePage {
	return getContext(exchangePageKey);
}

export function setExchangePageContext(holdings: Holding[] = []): ExchangePage {
	const exchangePage = $state({ activeRacer: undefined, showDetails: false, holdings });
	return setContext(exchangePageKey, exchangePage);
}
