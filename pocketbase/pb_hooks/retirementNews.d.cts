type RetirementNewsEntity = { id: string; name: string };
declare const news: {
	buildRetirementStory(facts: {
		eventId: string;
		occurredAt: string;
		racer: RetirementNewsEntity;
		trainer?: RetirementNewsEntity | null;
		league?: RetirementNewsEntity | null;
		careerLoad: number;
		reason: 'age' | 'career_load' | 'health';
	}): {
		headline: string;
		summary: string;
		category: 'retirement';
		importance: number;
		publishedAt: string;
		templateVersion: 'retirement-story-v2';
		links: Array<{ kind: 'racer' | 'trainer' | 'league'; id: string; label: string; href: string }>;
	};
};
export = news;
