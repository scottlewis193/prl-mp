import careerRules from '../../../pocketbase/pb_hooks/trainerCareer.cjs';
import type { TrainerCareer, TrainerChampionshipFact, TrainerRaceResultFact } from '$lib/types';

export const buildTrainerCareer: (
	results: TrainerRaceResultFact[],
	championships?: TrainerChampionshipFact[]
) => TrainerCareer = careerRules.buildTrainerCareer;

type TrainerResultReader = {
	findRecordsByFilter(
		collection: string,
		filter: string,
		sort: string,
		limit: number,
		offset: number,
		params: { trainerId: string }
	): unknown[];
};

export const loadAllTrainerRaceResults: (app: TrainerResultReader, trainerId: string) => unknown[] =
	careerRules.loadAllTrainerRaceResults;
