import type { Racer } from '$lib/types';

export function startLapTimer(racers: Racer[]) {
	for (const racer of racers) {
		if (!racer.currentRace.lapStartTime) {
			racer.currentRace.lapStartTime = Date.now() / 1000;
		}
	}
}

export function recordLapTime(racer: Racer, lapNumber: number) {
	if (!racer.currentRace.lapStartTime) {
		return;
	}

	const lapTime = Number((Date.now() / 1000 - racer.currentRace.lapStartTime).toFixed(3));

	racer.currentRace.lapTimes[lapNumber] = lapTime;
	racer.currentRace.bestLapTime =
		racer.currentRace.bestLapTime !== undefined && racer.currentRace.bestLapTime !== 0
			? Math.min(racer.currentRace.bestLapTime, lapTime)
			: lapTime;
	racer.currentRace.lapStartTime = undefined;
}
