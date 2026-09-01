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
	result: { position: number; points: number; outcome?: 'finished' | 'dnf' }
): LeagueStanding;

export function orderLeagueStandings(standings: LeagueStanding[]): LeagueStanding[];

export function pointsForRaceSettlement(
	raceFormat: { type?: string; ranked?: boolean; rulesVersion?: string } | undefined,
	pointsCurve: number[],
	positionsOrFinisherCount: number | number[]
): number[] | null;
