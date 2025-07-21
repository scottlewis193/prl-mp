import { getContext, setContext } from 'svelte';

type LeagueType = {
	id: string;
	name: string;
	prizeMoneyScaling: number;
	minRanking: number;
	maxRanking: number;
	maxPlayers: number;
};

export class League implements LeagueType {
	id: string = $state('');
	name: string = $state('');
	prizeMoneyScaling: number = $state(1);
	minRanking: number = $state(1);
	maxRanking: number = $state(1);
	maxPlayers: number = $state(1);
}

const leaguesKey = Symbol('leagues');

export function getLeaguesContext(leagues: League[]) {
	return getContext(leaguesKey);
}

export function setLeaguesContext(leagues: League[]) {
	const _leagues = $state(leagues);
	return setContext(leaguesKey, _leagues);
}
