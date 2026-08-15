import { fail, redirect } from '@sveltejs/kit';

function placementMessage(error: unknown): string {
	if (!error || typeof error !== 'object' || !('status' in error) || error.status !== 400) {
		return 'Unable to place this wager right now. Please try again.';
	}
	if (!('response' in error) || !error.response || typeof error.response !== 'object') {
		return 'Check the wager details and try again.';
	}
	const message = 'message' in error.response ? error.response.message : '';
	return typeof message === 'string' && message
		? message
		: 'Check the wager details and try again.';
}

export const load = async ({ locals }) => {
	if (!locals.user) return redirect(303, '/login');
	const now = new Date().toISOString();
	const [races, racers, wagers] = await Promise.all([
		locals.pb.collection('races').getFullList({
			filter: locals.pb.filter(
				'(status = "pending" || status = "countdown") && bettingCutoff > {:now}',
				{ now }
			),
			sort: 'startTime',
			fields: 'id,name,status,startTime,bettingCutoff,markets'
		}),
		locals.pb.collection('racers').getFullList({
			filter: 'race != ""',
			fields: 'id,name,race'
		}),
		locals.pb.collection('wagers').getFullList({
			sort: '-placedAt',
			expand: 'race,selection'
		})
	]);

	const eligibleRaces = races.filter(
		(race) =>
			race.markets?.winnerType === 'winner' &&
			Array.isArray(race.markets?.winnerSelections) &&
			race.markets.winnerSelections.length >= 2
	);

	return {
		balance: Number(locals.user.balance ?? 0),
		requestId: crypto.randomUUID(),
		races: eligibleRaces,
		racers,
		openWagers: wagers.filter((wager) => wager.status === 'open'),
		historicalWagers: wagers.filter((wager) => wager.status !== 'open')
	};
};

export const actions = {
	async place({ request, locals }) {
		if (!locals.user) return redirect(303, '/login');
		const formData = await request.formData();
		const raceId = formData.get('raceId')?.toString().trim() ?? '';
		const selection = formData.get('selection')?.toString().trim() ?? '';
		const requestId = formData.get('requestId')?.toString().trim() ?? '';
		const stake = Number(formData.get('stake'));
		if (!raceId || !selection || !requestId || !Number.isFinite(stake)) {
			return fail(400, { error: 'Choose a selection and enter a valid stake.' });
		}

		try {
			const wager = await locals.pb.send<{ id: string }>('/api/prl/wagers/place', {
				method: 'POST',
				body: {
					raceId,
					market: 'winner',
					selection,
					stake,
					idempotencyKey: requestId
				}
			});
			const refreshed = await locals.pb.collection('users').authRefresh();
			locals.user = structuredClone(refreshed.record);
			return { success: true, wagerId: wager.id };
		} catch (error) {
			return fail(400, { error: placementMessage(error) });
		}
	}
};
