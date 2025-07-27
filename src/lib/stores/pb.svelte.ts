import { PUBLIC_PB_URL } from '$env/static/public';
import PocketBase from 'pocketbase';
import { getContext, setContext } from 'svelte';

const pbKey = Symbol('pb');

export function setPBContext(): PocketBase {
	const pb: PocketBase = $state(new PocketBase(PUBLIC_PB_URL));
	return setContext(pbKey, pb);
}

export function getPBContext(): PocketBase {
	return getContext(pbKey);
}
