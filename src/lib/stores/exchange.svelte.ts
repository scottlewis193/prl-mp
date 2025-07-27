import { getContext, setContext } from 'svelte';
import { Racer } from './racer.svelte';

const exchangePageKey = Symbol('exchangePage');

type ExchangePage = {
	activeRacer: Racer | undefined;
	showDetails: boolean;
};

export function getExchangePageContext(): ExchangePage {
	return getContext(exchangePageKey);
}

export function setExchangePageContext(): ExchangePage {
	const exchangePage = $state({ activeRacer: undefined, showDetails: false });
	return setContext(exchangePageKey, exchangePage);
}
