import standingsRules from '../../pocketbase/pb_hooks/leagueStandings.cjs';

export type LeagueStanding = {
	racerId: string;
	points: number;
	starts: number;
	wins: number;
	podiums: number;
	bestFinish: number;
	recentForm: number[];
};

export function applyLeagueRaceResult(
	standing: LeagueStanding,
	result: { position: number; points: number }
): LeagueStanding {
	return standingsRules.applyLeagueRaceResult(standing, result);
}

export function orderLeagueStandings(standings: LeagueStanding[]): LeagueStanding[] {
	return standingsRules.orderLeagueStandings(standings);
}

export function pointsForRaceSettlement(
	raceFormat: { type?: string; ranked?: boolean; rulesVersion?: string } | undefined,
	pointsCurve: number[],
	positionsOrFinisherCount: number | number[]
): number[] | null {
	return standingsRules.pointsForRaceSettlement(raceFormat, pointsCurve, positionsOrFinisherCount);
}
