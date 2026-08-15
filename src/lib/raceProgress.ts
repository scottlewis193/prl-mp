import type { Racer, RaceTrackType } from './types';

export function getRacerProgress(racer: Racer, racetrack: RaceTrackType): number {
	const completedCheckpointDistance = racetrack.checkpoints
		.slice(0, racer.currentRace.checkpointIndex)
		.reduce((distance, checkpoint, index) => {
			const next = racetrack.checkpoints[index + 1] ?? checkpoint;
			return distance + Math.hypot(next.x - checkpoint.x, next.y - checkpoint.y);
		}, 0);
	return (
		racer.currentRace.lapsCompleted * racetrack.totalLength +
		completedCheckpointDistance +
		racer.currentRace.distanceFromCheckpoint
	);
}

export function getLeadingRacer(racers: Racer[], racetrack: RaceTrackType): Racer | undefined {
	return racers.reduce<Racer | undefined>(
		(leader, racer) =>
			!leader || getRacerProgress(racer, racetrack) > getRacerProgress(leader, racetrack)
				? racer
				: leader,
		undefined
	);
}
