type SeasonNewsEntity = { id: string; name: string };
declare const news: {
	buildSeasonStory(facts: {
		eventId: string;
		occurredAt: string;
		season: SeasonNewsEntity;
		champions: Array<{ racer: SeasonNewsEntity; league: SeasonNewsEntity }>;
		movements: Array<{
			racer: SeasonNewsEntity;
			fromLeague: SeasonNewsEntity;
			toLeague: SeasonNewsEntity;
			direction: 'promoted' | 'relegated';
		}>;
	}): {
		headline: string;
		summary: string;
		category: 'season_update';
		importance: 95;
		publishedAt: string;
		templateVersion: 'season-story-v1';
		links: Array<{ kind: 'racer' | 'league'; id: string; label: string; href: string }>;
	};
};
export = news;
