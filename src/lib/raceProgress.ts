import type { RaceClassEntry, Racer, RaceTrackType } from './types';

export function classifyRacePositions(orderedRacerIds: string[], classEntries: RaceClassEntry[]) {
	const entryByRacer = new Map(classEntries.map((entry) => [entry.racerId, entry]));
	const classCounts = new Map<string, number>();
	return orderedRacerIds.flatMap((racerId, index) => {
		const entry = entryByRacer.get(racerId);
		if (!entry) return [];
		const classPosition = (classCounts.get(entry.classId) ?? 0) + 1;
		classCounts.set(entry.classId, classPosition);
		return [
			{
				racerId,
				overallPosition: index + 1,
				classPosition,
				className: entry.className
			}
		];
	});
}

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
