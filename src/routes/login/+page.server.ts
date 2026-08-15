import { fail, redirect } from '@sveltejs/kit';

function isDuplicateEmail(error: unknown): boolean {
	if (!error || typeof error !== 'object' || !('response' in error)) return false;

	const response = error.response;
	if (!response || typeof response !== 'object' || !('data' in response)) return false;

	const data = response.data;
	if (!data || typeof data !== 'object' || !('email' in data)) return false;

	const email = data.email;
	return (
		!!email &&
		typeof email === 'object' &&
		'code' in email &&
		email.code === 'validation_not_unique'
	);
}

function hasStatus(error: unknown, status: number): boolean {
	return !!error && typeof error === 'object' && 'status' in error && error.status === status;
}

async function readCredentials(request: Request, mode: 'login' | 'register') {
	const formData = await request.formData();
	const email = formData.get('email')?.toString().trim().toLowerCase();

	return {
		email,
		password: formData.get('password')?.toString(),
		passwordConfirm: formData.get('passwordConfirm')?.toString(),
		form: { mode, email: email ?? '' }
	};
}

export const load = async ({ url, locals }) => {
	if (locals.pb.authStore.record) {
		return redirect(303, '/');
	}
};

export const actions = {
	async register({ request, locals }) {
		const { email, password, passwordConfirm, form } = await readCredentials(request, 'register');

		if (!email || !password || !passwordConfirm) {
			return fail(400, {
				...form,
				error: 'Email, password, and password confirmation are required'
			});
		}

		if (password !== passwordConfirm) {
			return fail(400, { ...form, error: 'Passwords do not match' });
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { ...form, error: 'Enter a valid email address' });
		}

		if (password.length < 8) {
			return fail(400, { ...form, error: 'Password must be at least 8 characters' });
		}

		try {
			await locals.pb.send('/api/prl/accounts/register', {
				method: 'POST',
				body: {
					email,
					password,
					passwordConfirm,
					options: {
						raceViewer: { leaderboardMode: 'interval', isViewing: false }
					},
					watchlist: []
				}
			});
		} catch (error) {
			if (isDuplicateEmail(error)) {
				return fail(400, { ...form, error: 'An account with this email already exists' });
			}
			return fail(503, {
				...form,
				error: 'Unable to create your account right now. Please try again'
			});
		}
		try {
			await locals.pb.collection('users').authWithPassword(email, password);
		} catch {
			return fail(503, {
				mode: 'login',
				email,
				error: 'Your account was created, but automatic sign-in failed. Please sign in'
			});
		}

		return redirect(303, '/');
	},
	async login({ request, locals }) {
		const { email, password, form } = await readCredentials(request, 'login');

		if (!email || !password) {
			return fail(400, { ...form, error: 'Email and password are required' });
		}

		try {
			await locals.pb.collection('users').authWithPassword(email, password);
		} catch (error) {
			if (hasStatus(error, 400)) {
				return fail(400, { ...form, error: 'Invalid email or password' });
			}
			return fail(503, { ...form, error: 'Unable to sign in right now. Please try again' });
		}

		if (!locals.pb.authStore.isValid) {
			return fail(400, { ...form, error: 'Invalid email or password' });
		}

		return redirect(303, `/`);
	}
};
