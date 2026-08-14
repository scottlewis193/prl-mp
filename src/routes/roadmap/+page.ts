export type RoadmapStatus = 'active' | 'planned' | 'completed';

export interface RoadmapItem {
	title: string;
	description: string;
}

export interface RoadmapSection {
	status: RoadmapStatus;
	title: string;
	summary: string;
	items: RoadmapItem[];
}

const roadmap: RoadmapSection[] = [
	{
		status: 'active',
		title: 'Live racing',
		summary: 'Making every race dependable, easy to follow, and exciting to watch.',
		items: [
			{
				title: 'Reliable race simulation',
				description:
					'Keep server-driven movement, lap timing, race completion, and live updates in sync.'
			},
			{
				title: 'A clearer race-day experience',
				description:
					'Refine the race list, live track view, and leaderboard so the action is easy to follow.'
			}
		]
	},
	{
		status: 'planned',
		title: 'Wagering and exchange',
		summary: 'Turning the early market screens into complete player journeys.',
		items: [
			{
				title: 'Player wagering',
				description: 'Back racers before a race and follow each wager through to its outcome.'
			},
			{
				title: 'Racer exchange',
				description:
					'Browse racers, inspect their performance, and manage a meaningful collection of holdings.'
			}
		]
	},
	{
		status: 'completed',
		title: 'League foundations',
		summary: 'The core services and tools that make a persistent league possible.',
		items: [
			{
				title: 'Player accounts',
				description: 'Registration, sign-in, session handling, and useful authentication errors.'
			},
			{
				title: 'Ready-to-race data',
				description:
					'Migrated league schema with seeded Pokémon, racers, sprites, and a default race.'
			},
			{
				title: 'Secure administration',
				description: 'Role-protected commands for operating and resetting local race data safely.'
			}
		]
	}
];

export function load() {
	return { roadmap };
}
