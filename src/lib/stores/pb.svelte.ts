import type PocketBase from 'pocketbase';
import { getContext, setContext } from 'svelte';
import pb from '$lib/pocketbase';

const pbKey = Symbol('pb');

export function setPBContext(): PocketBase {
	return setContext(pbKey, pb);
}

export function getPBContext(): PocketBase {
	return getContext(pbKey);
}
