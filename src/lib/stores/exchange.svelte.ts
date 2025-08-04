import type { ExchangePage } from '$lib/types';
import { getContext, setContext } from 'svelte';

const exchangePageKey = Symbol('exchangePage');

export function getExchangePageContext(): ExchangePage {
	return getContext(exchangePageKey);
}

export function setExchangePageContext(): ExchangePage {
	const exchangePage = $state({ activeRacer: undefined, showDetails: false });
	return setContext(exchangePageKey, exchangePage);
}
