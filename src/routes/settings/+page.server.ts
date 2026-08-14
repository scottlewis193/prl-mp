import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.user) return redirect(303, '/login');
	return { user: locals.user };
};

export const actions = {
	async updateAccount({ request, locals }) {
		if (!locals.user) return redirect(303, '/login');

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const leaderboardMode = formData.get('leaderboardMode')?.toString();

		if (!name) return fail(400, { error: 'Display name is required' });
		if (leaderboardMode !== 'interval' && leaderboardMode !== 'leader') {
			return fail(400, { error: 'Choose a valid leaderboard mode' });
		}

		const currentOptions = locals.user.options ?? {};
		const currentRaceViewer = currentOptions.raceViewer ?? {};

		try {
			const user = await locals.pb.collection('users').update(locals.user.id, {
				name,
				options: {
					...currentOptions,
					raceViewer: {
						...currentRaceViewer,
						leaderboardMode
					}
				}
			});

			locals.pb.authStore.save(locals.pb.authStore.token, user);
			locals.user = structuredClone(user);
			return { success: true, user: locals.user };
		} catch {
			return fail(503, { error: 'Unable to save your account settings right now' });
		}
	}
};
