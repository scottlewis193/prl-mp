import type { AuthModel, AuthRecord } from 'pocketbase';
import { getContext, setContext } from 'svelte';
import PocketBase from 'pocketbase';
import type { User } from '$lib/types';

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

export async function subscribeToUsers(usersAry: User[], pb: PocketBase) {
	await pb.collection('users').unsubscribe();
	await pb.collection('users').subscribe('*', async function (e) {
		const userRecord = e.record as unknown as User;
		switch (e.action) {
			case 'create':
				usersAry.push(userRecord);
				break;
			case 'update':
				const index = usersAry.findIndex((r) => r.id === userRecord.id);
				if (index !== -1) {
					usersAry[index] = userRecord;
				} else {
					usersAry.push(userRecord);
				}
				break;
			case 'delete':
				usersAry.splice(
					usersAry.findIndex((r) => r.id === userRecord.id),
					1
				);
				break;
		}
	});
}
