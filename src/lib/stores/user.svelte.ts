import type { AuthModel, AuthRecord } from 'pocketbase';
import { getContext, setContext } from 'svelte';

export type User = AuthRecord & {
	id: string;
	name: string;
	email: string;
	avatar: string;
	options: {
		raceViewer: {
			leaderboardMode: 'interval' | 'leader';
			isViewing: boolean;
		};
	};
	watchlist: string[];
};

const defaultUserOptions: {
	raceViewer: { leaderboardMode: 'interval' | 'leader'; isViewing: boolean };
} = {
	raceViewer: {
		leaderboardMode: 'interval',
		isViewing: false
	}
};

// export const defaultUser: User = {
// 	id: '',
// 	name: '',
// 	email: '',
// 	avatar: '',
// 	options: defaultUserOptions,
// 	watchlist: []
// };

const userKey = Symbol('user');

export function setUserContext(user: Partial<User>): Partial<User> {
	const _user: Partial<User> = $state(user);
	return setContext(userKey, _user);
}

export function getUserContext(): User | null {
	return getContext(userKey);
}
