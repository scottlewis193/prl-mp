import { error } from '@sveltejs/kit';
import type { Race, Racer, RaceTrackType } from '$lib/types';

function recordFilter(field: string, values: string[]): string {
	return values.map((value) => `${field} = ${JSON.stringify(value)}`).join(' || ');
}

export const load = async ({ params, locals }) => {
	let race: Race;
	try {
		race = (await locals.pb.collection('races').getOne(params.id)) as unknown as Race;
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 404) {
			error(404, 'Race not found. It may have been deleted.');
		}
		throw cause;
	}

	try {
		const participantIds = [
			...new Set([race.winner, ...(race.finishingOrder ?? [])].filter(Boolean))
		];
		const participantFilter = [
			`race = ${JSON.stringify(params.id)}`,
			...(participantIds.length > 0 ? [`(${recordFilter('id', participantIds)})`] : [])
		].join(' || ');
		const [racers, racetrack] = await Promise.all([
			locals.pb.collection('racers').getFullList({
				filter: participantFilter,
				batch: 1000,
				expand: 'pokemon,trainer,league'
			}),
			locals.pb.collection('racetracks').getOne(race.racetrack)
		]);
		return {
			race,
			racers: racers as unknown as Racer[],
			racetrack: racetrack as unknown as RaceTrackType
		};
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause && cause.status === 404) {
			error(404, 'Race data is no longer available.');
		}
		throw cause;
	}
};
