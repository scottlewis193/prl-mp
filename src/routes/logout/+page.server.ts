import { redirect } from '@sveltejs/kit';

export const load = () => redirect(303, '/');

export const actions = {
	async default({ locals }) {
		locals.pb.authStore.clear();
		locals.user = null;
		return redirect(303, '/login');
	}
};
