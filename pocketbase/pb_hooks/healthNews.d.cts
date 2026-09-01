type HealthNewsEntity = { id: string; name: string };

declare const healthNews: {
	buildHealthStory(facts: {
		eventId: string;
		occurredAt: string;
		transition: 'onset' | 'recovery';
		racer: HealthNewsEntity;
		trainer?: HealthNewsEntity | null;
		league?: HealthNewsEntity | null;
		condition: {
			id: string;
			kind: 'injury' | 'illness';
			severity: 'minor' | 'moderate' | 'severe';
			cause: string;
			onsetAt: string;
			expectedRecoveryAt: string;
			eligibilityEffect: 'performance_penalty' | 'ineligible';
		};
	}): {
		headline: string;
		summary: string;
		category: 'health_onset' | 'health_recovery';
		importance: number;
		publishedAt: string;
		templateVersion: 'health-story-v2';
		links: Array<{
			kind: 'racer' | 'trainer' | 'league';
			id: string;
			label: string;
			href: string;
		}>;
	};
};

export = healthNews;
