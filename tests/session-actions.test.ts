import assert from 'node:assert/strict';
import test from 'node:test';

import { load as loadLayout } from '../src/routes/+layout.server';
import { actions as logoutActions } from '../src/routes/logout/+page.server';
import {
	actions as settingsActions,
	load as loadSettings
} from '../src/routes/settings/+page.server';

function requestWith(fields: Record<string, string>): Request {
	const formData = new FormData();
	for (const [name, value] of Object.entries(fields)) formData.set(name, value);

	return new Request('http://localhost/settings', { method: 'POST', body: formData });
}

test('layout initializes every route with the authenticated player', async () => {
	const user = { id: 'player-1', name: 'Misty', watchlist: ['racer-7'] };
	const records = {
		races: [{ id: 'race-1' }],
		racers: [{ id: 'racer-1' }],
		racetracks: [{ id: 'track-1' }]
	};

	const result = await loadLayout({
		locals: {
			user,
			pb: {
				collection(name: keyof typeof records) {
					return { getFullList: async () => records[name] };
				}
			}
		},
		url: new URL('http://localhost/exchange')
	} as never);

	assert.deepEqual(result, { user, url: '/exchange', ...records });
});

test('logout clears server authentication state and returns to the login flow', async () => {
	let cleared = false;
	const locals = {
		user: { id: 'player-1' },
		pb: {
			authStore: {
				clear: () => {
					cleared = true;
				}
			}
		}
	};

	await assert.rejects(
		() => logoutActions.default({ locals } as never),
		(error: { status?: number; location?: string }) =>
			error.status === 303 && error.location === '/login'
	);

	assert.equal(cleared, true);
	assert.equal(locals.user, null);
});

test('account settings persist preferences without discarding other user data', async () => {
	const currentUser = {
		id: 'player-1',
		name: 'Misty',
		watchlist: ['racer-7'],
		options: {
			raceViewer: {
				cameraMode: 'free',
				leaderboardMode: 'interval',
				isViewing: true
			},
			theme: 'system',
			accessibility: { reducedMotion: false, highContrast: false },
			notifications: { raceStarted: true }
		}
	};
	const calls: unknown[] = [];
	const authStoreCalls: unknown[] = [];
	const updatedUser = {
		...currentUser,
		name: 'Champion Misty',
		options: {
			...currentUser.options,
			raceViewer: { cameraMode: 'follow', leaderboardMode: 'leader', isViewing: true },
			theme: 'dark',
			accessibility: { reducedMotion: true, highContrast: true }
		}
	};
	const locals = {
		user: currentUser,
		pb: {
			authStore: {
				token: 'session-token',
				save: (token: string, record: unknown) => authStoreCalls.push({ token, record })
			},
			collection: (name: string) => {
				assert.equal(name, 'users');
				return {
					update: async (id: string, value: unknown) => {
						calls.push({ id, value });
						return updatedUser;
					}
				};
			}
		}
	};

	const result = await settingsActions.updateAccount({
		request: requestWith({
			name: ' Champion Misty ',
			cameraMode: 'follow',
			leaderboardMode: 'leader',
			theme: 'dark',
			reducedMotion: 'on',
			highContrast: 'on'
		}),
		locals
	} as never);

	assert.deepEqual(calls, [
		{
			id: 'player-1',
			value: {
				name: 'Champion Misty',
				options: {
					raceViewer: {
						cameraMode: 'follow',
						leaderboardMode: 'leader',
						isViewing: true
					},
					theme: 'dark',
					accessibility: { reducedMotion: true, highContrast: true },
					notifications: { raceStarted: true }
				}
			}
		}
	]);
	assert.deepEqual(locals.user, updatedUser);
	assert.deepEqual(authStoreCalls, [{ token: 'session-token', record: updatedUser }]);
	assert.deepEqual(result, { success: true, user: updatedUser });
});

test('account settings reject invalid preferences before updating PocketBase', async () => {
	let collectionCalled = false;
	const result = await settingsActions.updateAccount({
		request: requestWith({
			name: 'Misty',
			cameraMode: 'free',
			leaderboardMode: 'fastest',
			theme: 'system'
		}),
		locals: {
			user: {
				id: 'player-1',
				options: { raceViewer: { leaderboardMode: 'interval', isViewing: false } }
			},
			pb: {
				collection: () => {
					collectionCalled = true;
				}
			}
		}
	} as never);

	assert.equal(collectionCalled, false);
	assert.equal('status' in result && result.status, 400);
	assert.equal('data' in result && result.data.error, 'Choose a valid leaderboard mode');
});

test('account settings reject unsupported camera and theme preferences', async () => {
	for (const fields of [
		{ cameraMode: 'cinematic', leaderboardMode: 'interval', theme: 'system' },
		{ cameraMode: 'free', leaderboardMode: 'interval', theme: 'neon' }
	]) {
		let collectionCalled = false;
		const result = await settingsActions.updateAccount({
			request: requestWith({ name: 'Misty', ...fields }),
			locals: {
				user: { id: 'player-1', options: {} },
				pb: {
					collection: () => {
						collectionCalled = true;
					}
				}
			}
		} as never);

		assert.equal(collectionCalled, false);
		assert.equal('status' in result && result.status, 400);
	}
});

test('protected account navigation sends an unauthenticated player to login', async () => {
	await assert.rejects(
		() => loadSettings({ locals: { user: null } } as never),
		(error: { status?: number; location?: string }) =>
			error.status === 303 && error.location === '/login'
	);
});
