import type { Racer, RaceSignificantEvent } from './types';

export function collectRaceSignificantEvents(racers: Racer[]): RaceSignificantEvent[] {
	const unique = new Map<string, RaceSignificantEvent>();
	for (const racer of racers) {
		for (const event of racer.currentRace?.significantEvents ?? []) unique.set(event.id, event);
	}
	return [...unique.values()].sort((left, right) =>
		left.occurredAt === right.occurredAt
			? left.id.localeCompare(right.id)
			: left.occurredAt.localeCompare(right.occurredAt)
	);
}
