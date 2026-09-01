declare const rosterNews: {
	buildRosterStory(facts: {
		eventId: string;
		occurredAt: string;
		transition: 'signing' | 'release';
		racer: { id: string; name: string };
		trainer: { id: string; name: string };
		league?: { id: string; name: string } | null;
		price: number;
	}): {
		headline: string;
		summary: string;
		category: 'signing' | 'release';
		importance: number;
		publishedAt: string;
		templateVersion: string;
		links: Array<{ kind: 'racer' | 'trainer' | 'league'; id: string; label: string; href: string }>;
	};
};

export = rosterNews;
