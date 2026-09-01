import type { Racer, RaceSignificantEvent } from './types';

export function mergeRaceSignificantEvents(
	existing: RaceSignificantEvent[] | undefined,
	created: RaceSignificantEvent[],
	limit = 100
): RaceSignificantEvent[] {
	const events = new Map((existing ?? []).map((event) => [event.id, event]));
	for (const event of created) events.set(event.id, event);
	return [...events.values()]
		.sort((left, right) =>
			left.occurredAt === right.occurredAt
				? left.id.localeCompare(right.id)
				: left.occurredAt.localeCompare(right.occurredAt)
		)
		.slice(-limit);
}

export function collectRaceSignificantEvents(racers: Racer[]): RaceSignificantEvent[] {
	const unique = new Map<string, RaceSignificantEvent>();
	for (const racer of racers) {
		for (const event of racer.currentRace?.significantEvents ?? []) unique.set(event.id, event);
	}
	return mergeRaceSignificantEvents(undefined, [...unique.values()], Number.POSITIVE_INFINITY);
}
