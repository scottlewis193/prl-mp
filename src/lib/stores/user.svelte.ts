import type { AuthModel } from 'pocketbase';

export interface User {
	id: string;
	name: string;
	email: string;
	avatar: string;
	options: {
		raceViewer: {
			leaderboardMode: 'interval' | 'leader';
		};
	};
}
