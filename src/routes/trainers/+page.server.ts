import type { Trainer, TrainerRaceResult } from '$lib/types';

export const load = async ({ locals }) => {
	const [trainers, results] = await Promise.all([
		locals.pb.collection('trainers').getFullList({ sort: 'name' }),
		locals.pb
			.collection('trainerRaceResults')
			.getFullList({ sort: '-occurredAt', expand: 'racer,race', batch: 500 })
	]);

	return {
		trainers: trainers as unknown as Trainer[],
		results: results as unknown as TrainerRaceResult[]
	};
};
