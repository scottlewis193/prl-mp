type NewsEntity = { id: string; name: string };
type RaceResultFacts = {
	eventId: string;
	occurredAt: string;
	race: NewsEntity & {
		format?: 'league_race' | 'grand_prix' | 'exhibition' | 'legends_exhibition';
	};
	winner?: NewsEntity;
	finishers: NewsEntity[];
	nonFinishers?: Array<NewsEntity & { reason: string; summary?: string }>;
	trainers: NewsEntity[];
	league: NewsEntity;
	track: NewsEntity;
	priceMovements?: Array<{
		racer: NewsEntity;
		previousPrice: number;
		price: number;
		sourceEvent: string;
	}>;
	winnerCareer?: { wins: number; starts: number };
	notableTactics?: Array<{ id: string; summary: string }>;
};

declare const raceNews: {
	stableTemplateIndex(value: string, templateCount: number): number;
	buildRaceResultStory(facts: RaceResultFacts): {
		headline: string;
		summary: string;
		category: 'race_result';
		importance: number;
		publishedAt: string;
		templateVersion: 'race-result-v4';
		links: Array<{
			kind: 'race' | 'racer' | 'trainer' | 'league' | 'track';
			id: string;
			label: string;
			href: string;
		}>;
	};
};

export = raceNews;
