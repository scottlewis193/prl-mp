import assert from 'node:assert/strict';
import test from 'node:test';

import { actions } from '../src/routes/login/+page.server';

function requestWith(fields: Record<string, string>): Request {
	const formData = new FormData();
	for (const [name, value] of Object.entries(fields)) formData.set(name, value);

	return new Request('http://localhost/login', { method: 'POST', body: formData });
}

test('registration creates a user with defaults and signs the new player in', async () => {
	const calls: Array<{ method: string; value: unknown }> = [];
	const users = {
		create: async (value: unknown) => calls.push({ method: 'create', value }),
		authWithPassword: async (email: string, password: string) =>
			calls.push({ method: 'authWithPassword', value: { email, password } })
	};
	const locals = {
		pb: {
			authStore: { isValid: true },
			collection: (name: string) => {
				assert.equal(name, 'users');
				return users;
			}
		}
	};

	await assert.rejects(
		() =>
			actions.register({
				request: requestWith({
					email: 'NewPlayer@example.com',
					password: 'password123',
					passwordConfirm: 'password123'
				}),
				locals
			} as never),
		(error: { status?: number; location?: string }) =>
			error.status === 303 && error.location === '/'
	);

	assert.deepEqual(calls, [
		{
			method: 'create',
			value: {
				email: 'newplayer@example.com',
				password: 'password123',
				passwordConfirm: 'password123',
				options: {
					raceViewer: { leaderboardMode: 'interval', isViewing: false }
				},
				watchlist: []
			}
		},
		{
			method: 'authWithPassword',
			value: { email: 'newplayer@example.com', password: 'password123' }
		}
	]);
});

test('registration rejects mismatched password confirmation before calling PocketBase', async () => {
	let collectionCalled = false;
	const result = await actions.register({
		request: requestWith({
			email: 'player@example.com',
			password: 'password123',
			passwordConfirm: 'different123'
		}),
		locals: {
			pb: {
				collection: () => {
					collectionCalled = true;
				}
			}
		}
	} as never);

	assert.equal(collectionCalled, false);
	assert.equal(result?.status, 400);
	assert.deepEqual(result?.data, {
		mode: 'register',
		email: 'player@example.com',
		error: 'Passwords do not match'
	});
});

test('registration validates the email and password on the server', async () => {
	for (const example of [
		{
			fields: { email: 'not-an-email', password: 'password123', passwordConfirm: 'password123' },
			error: 'Enter a valid email address'
		},
		{
			fields: { email: 'player@example.com', password: 'short', passwordConfirm: 'short' },
			error: 'Password must be at least 8 characters'
		}
	]) {
		let collectionCalled = false;
		const result = await actions.register({
			request: requestWith(example.fields),
			locals: {
				pb: {
					collection: () => {
						collectionCalled = true;
					}
				}
			}
		} as never);

		assert.equal(collectionCalled, false);
		assert.equal(result?.status, 400);
		assert.equal(result?.data.error, example.error);
	}
});

test('registration reports a duplicate account as a useful form error', async () => {
	const result = await actions.register({
		request: requestWith({
			email: 'existing@example.com',
			password: 'password123',
			passwordConfirm: 'password123'
		}),
		locals: {
			pb: {
				collection: () => ({
					create: async () => {
						throw {
							status: 400,
							response: { data: { email: { code: 'validation_not_unique' } } }
						};
					}
				})
			}
		}
	} as never);

	assert.equal(result?.status, 400);
	assert.deepEqual(result?.data, {
		mode: 'register',
		email: 'existing@example.com',
		error: 'An account with this email already exists'
	});
});

test('registration reports backend failures without exposing internal errors', async () => {
	const result = await actions.register({
		request: requestWith({
			email: 'player@example.com',
			password: 'password123',
			passwordConfirm: 'password123'
		}),
		locals: {
			pb: {
				collection: () => ({
					create: async () => {
						throw new Error('database connection details');
					}
				})
			}
		}
	} as never);

	assert.equal(result?.status, 503);
	assert.deepEqual(result?.data, {
		mode: 'register',
		email: 'player@example.com',
		error: 'Unable to create your account right now. Please try again'
	});
});

test('registration explains when the account was created but automatic sign-in fails', async () => {
	const result = await actions.register({
		request: requestWith({
			email: 'player@example.com',
			password: 'password123',
			passwordConfirm: 'password123'
		}),
		locals: {
			pb: {
				collection: () => ({
					create: async () => undefined,
					authWithPassword: async () => {
						throw new Error('connection details');
					}
				})
			}
		}
	} as never);

	assert.equal(result?.status, 503);
	assert.deepEqual(result?.data, {
		mode: 'login',
		email: 'player@example.com',
		error: 'Your account was created, but automatic sign-in failed. Please sign in'
	});
});

test('login authenticates an existing player and redirects home', async () => {
	const calls: unknown[] = [];
	const locals = {
		pb: {
			authStore: { isValid: true },
			collection: (name: string) => {
				assert.equal(name, 'users');
				return {
					authWithPassword: async (email: string, password: string) =>
						calls.push({ email, password })
				};
			}
		}
	};

	await assert.rejects(
		() =>
			actions.login({
				request: requestWith({ email: ' Player@example.com ', password: 'password123' }),
				locals
			} as never),
		(error: { status?: number; location?: string }) =>
			error.status === 303 && error.location === '/'
	);

	assert.deepEqual(calls, [{ email: 'player@example.com', password: 'password123' }]);
});

test('login reports invalid credentials as a form error', async () => {
	const result = await actions.login({
		request: requestWith({ email: 'player@example.com', password: 'wrong-password' }),
		locals: {
			pb: {
				authStore: { isValid: false },
				collection: () => ({
					authWithPassword: async () => {
						throw { status: 400 };
					}
				})
			}
		}
	} as never);

	assert.equal(result?.status, 400);
	assert.deepEqual(result?.data, {
		mode: 'login',
		email: 'player@example.com',
		error: 'Invalid email or password'
	});
});

test('login reports backend failures without exposing internal errors', async () => {
	const result = await actions.login({
		request: requestWith({ email: 'player@example.com', password: 'password123' }),
		locals: {
			pb: {
				authStore: { isValid: false },
				collection: () => ({
					authWithPassword: async () => {
						throw new Error('connection details');
					}
				})
			}
		}
	} as never);

	assert.equal(result?.status, 503);
	assert.deepEqual(result?.data, {
		mode: 'login',
		email: 'player@example.com',
		error: 'Unable to sign in right now. Please try again'
	});
});
