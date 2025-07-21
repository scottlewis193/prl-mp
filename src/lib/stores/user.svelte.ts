import type { AuthModel } from 'pocketbase';
import { getContext, setContext } from 'svelte';

export interface User {
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
}

const defaultUserOptions: {
	raceViewer: { leaderboardMode: 'interval' | 'leader'; isViewing: boolean };
} = {
	raceViewer: {
		leaderboardMode: 'interval',
		isViewing: false
	}
};

export const defaultUser: User = {
	id: '',
	name: '',
	email: '',
	avatar: '',
	options: defaultUserOptions
};

const userKey = Symbol('user');

export function setUserContext(user: User): User {
	const _user = $state(user);
	return setContext(userKey, _user);
}

export function getUserContext(): User | null {
	return getContext(userKey);
}
