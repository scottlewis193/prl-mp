import { DISABLE_AUTH } from '$env/static/private';
import { loadDashboard } from '$lib/server/dashboardRepository';
import { redirect } from '@sveltejs/kit';

export const load = async ({ url, locals }) => {
	if (!locals.pb.authStore.record && !DISABLE_AUTH) {
		return redirect(303, '/login');
	}
	if (!locals.user) {
		return {
			user: locals.user,
			url: url.pathname,
			dashboardState: {
				dashboard: null,
				error: 'Sign in to load your dashboard.'
			}
		};
	}
	const dashboardState = loadDashboard(locals.pb, locals.user)
		.then((dashboard) => ({ dashboard, error: null }))
		.catch((error) => {
			console.error('Dashboard data load failed:', error);
			return {
				dashboard: null,
				error: 'Could not load your dashboard. Please try again.'
			};
		});
	return { user: locals.user, url: url.pathname, dashboardState };
};
