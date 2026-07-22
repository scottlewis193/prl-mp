import { addSubscription } from '$lib/server/subscriptions';
import { hasServerCredentials } from '$lib/server/pocketbase';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	if (!hasServerCredentials) {
		throw error(503, 'Push subscriptions require PB_USER and PB_PASS');
	}

	const _subscription = await request.json();

	// Store subscription
	await addSubscription(_subscription);

	return json({ status: 'subscribed' });
};
