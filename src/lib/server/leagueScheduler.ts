import pb from './pocketbase';
import type { LeagueScheduleResult } from '$lib/leagueSchedule';

export async function reconcileLeagueSchedule(): Promise<LeagueScheduleResult> {
	return pb.send('/api/prl/schedule/reconcile', {
		method: 'POST',
		body: {}
	}) as Promise<LeagueScheduleResult>;
}
