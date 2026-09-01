import type { Racer } from '$lib/types';

export function selectUnassignedRacers(racers: Racer[]) {
	return racers.filter(
		(racer) => !racer.race && !racer.trainer && !racer.league && !racer.status?.retired
	);
}
