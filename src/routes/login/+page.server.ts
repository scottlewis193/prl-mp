import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ url, locals }) => {
	if (locals.pb.authStore.record) {
		return redirect(303, '/');
	}
};

export const actions = {
	async default({ request, locals }) {
		const formData = await request.formData();

		const email: string | undefined = formData.get('email')?.toString();
		const password: string | undefined = formData.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required' });
		}

		await locals.pb.collection('users').authWithPassword(email, password);

		if (!locals.pb.authStore.isValid) {
			return fail(400, { error: 'Invalid email or password' });
		}

		console.log('auth success');

		return redirect(303, `/`);
	}
};
