import { DISABLE_AUTH } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

export const load = async ({ url, locals }) => {
	if (!locals.pb.authStore.record && !DISABLE_AUTH) {
		return redirect(303, '/login');
	}
	return { user: locals.user, url: url.pathname };
};
