import { PUBLIC_PB_URL } from '$env/static/public';
import PocketBase from 'pocketbase';
import { getContext, setContext } from 'svelte';
import { resolvePocketBaseUrl } from '$lib/pocketbase-url';

const pbKey = Symbol('pb');

export function setPBContext(): PocketBase {
	const pb: PocketBase = $state(new PocketBase(resolvePocketBaseUrl(PUBLIC_PB_URL)));
	return setContext(pbKey, pb);
}

export function getPBContext(): PocketBase {
	return getContext(pbKey);
}
