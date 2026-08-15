type TrainerRaceResultFact = {
	id: string;
	raceId: string;
	racerId: string;
	trainerId?: string;
	position: number;
	earnings: number;
	occurredAt: string;
};

type TrainerRecentResult = Omit<TrainerRaceResultFact, 'id' | 'trainerId'> & { resultId: string };
type TrainerCareer = {
	starts: number;
	wins: number;
	podiums: number;
	earnings: number;
	championships: number;
	recentResults: TrainerRecentResult[];
};

type TrainerChampionshipFact = { id: string; trainerId: string; occurredAt: string };

declare const trainerCareer: {
	RECENT_RESULT_LIMIT: number;
	emptyTrainerCareer(): TrainerCareer;
	buildTrainerCareer(
		results: TrainerRaceResultFact[],
		championships?: TrainerChampionshipFact[]
	): TrainerCareer;
	loadAllTrainerRaceResults(app: unknown, trainerId: string): unknown[];
	rebuildTrainerCareer(app: unknown, trainerId: string): void;
};
export = trainerCareer;
