import { addSubscription } from '$lib/server/subscriptions';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const _subscription = await request.json();

	// Store subscription
	addSubscription(_subscription);

	return json({ status: 'subscribed' });
};
