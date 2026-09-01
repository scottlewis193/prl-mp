import type { Race, Racer, RaceTrackType } from '$lib/types';

export const load = async ({ locals }) => {
	const [races, racers, racetracks] = await Promise.all([
		locals.pb.collection('races').getFullList({ sort: 'startTime' }),
		locals.pb.collection('racers').getFullList({
			batch: 1000,
			fields: 'id,name,race'
		}),
		locals.pb.collection('racetracks').getFullList({
			fields:
				'id,name,length,totalLength,width,surface,hazards,corneringDemand,speedBias,risk,compatibleFormats'
		})
	]);

	return {
		races: races as unknown as Race[],
		racers: racers as unknown as Racer[],
		racetracks: racetracks as unknown as RaceTrackType[]
	};
};
