import { getContext, setContext } from 'svelte';

const clientKey = Symbol('client');

type Client = {
	url: string;
	isNavigating: boolean;
};

const client: Client = {
	url: '',
	isNavigating: false
};

export function getClientContext(): Client {
	return getContext(clientKey);
}

export function setClientContext(): Client {
	const _client = $state(client);
	return setContext(clientKey, _client);
}
