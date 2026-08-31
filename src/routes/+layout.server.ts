import type { Race, Racer, RaceTrackType } from '$lib/types';

export const load = async ({ locals, url }) => {
	const [races, racers, racetracks] = await Promise.all([
		locals.pb.collection('races').getFullList(),
		locals.pb
			.collection('racers')
			.getFullList({ batch: 1000, expand: 'pokemon,trainer,league' }),
		locals.pb.collection('racetracks').getFullList()
	]);

	return {
		user: locals.user,
		url: url.pathname,
		races: races as unknown as Race[],
		racers: racers as unknown as Racer[],
		racetracks: racetracks as unknown as RaceTrackType[]
	};
};
