import type { Racer } from '$lib/types';

export function shouldFinishRace(racers: Pick<Racer, 'currentRace'>[]) {
	return racers.length > 0 && racers.every((racer) => racer.currentRace.finished);
}
