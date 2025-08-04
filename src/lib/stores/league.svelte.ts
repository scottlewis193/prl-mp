import type { League } from '$lib/types';
import { getContext, setContext } from 'svelte';

const leaguesKey = Symbol('leagues');

export function getLeaguesContext(leagues: League[]) {
	return getContext(leaguesKey);
}

export function setLeaguesContext(leagues: League[]) {
	const _leagues = $state(leagues);
	return setContext(leaguesKey, _leagues);
}
