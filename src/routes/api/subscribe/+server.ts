import { VAPID_PRIVATE_KEY } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { hasServerCredentials } from '$lib/server/pocketbase';
import {
	createPushSubscriptionService,
	PushSubscriptionServiceError
} from '$lib/server/pushSubscriptionService';
import { hasSubscription, removeSubscription, saveSubscription } from '$lib/server/subscriptions';
import { error, json, type RequestHandler } from '@sveltejs/kit';

const service = createPushSubscriptionService({
	configured: Boolean(hasServerCredentials && PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
	publicKey: PUBLIC_VAPID_PUBLIC_KEY,
	save: saveSubscription,
	remove: removeSubscription,
	has: hasSubscription
});

function toHttpError(cause: unknown): never {
	if (cause instanceof PushSubscriptionServiceError) throw error(cause.status, cause.message);
	throw error(503, 'Unable to update push notification subscription');
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const endpoint = url.searchParams.get('endpoint');
	if (!endpoint) return json(service.configuration());
	try {
		return json(await service.status(locals.user?.id, endpoint));
	} catch (cause) {
		return toHttpError(cause);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		return json(await service.subscribe(locals.user?.id, await request.json()));
	} catch (cause) {
		return toHttpError(cause);
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const payload = await request.json();
		return json(await service.unsubscribe(locals.user?.id, payload?.endpoint));
	} catch (cause) {
		return toHttpError(cause);
	}
};
