// src/routes/api/notify/+server.ts
import { error, json, type RequestHandler } from '@sveltejs/kit';
import webpush from 'web-push';

import { VAPID_PRIVATE_KEY } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { getSubscriptions } from '$lib/server/subscriptions'; // your own subscription store
import { hasServerCredentials, SERVER_USER_ID } from '$lib/server/pocketbase';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!hasServerCredentials) {
		throw error(503, 'Push notifications require PB_USER and PB_PASS');
	}
	if (locals.user?.id !== SERVER_USER_ID) {
		throw error(403, 'Only the service account can send push notifications');
	}
	if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
		throw error(503, 'Push notifications require VAPID keys');
	}

	webpush.setVapidDetails('mailto:you@example.com', PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

	const payload = await request.json(); // e.g. { title: 'Hello', body: 'Test' }
	if (
		(typeof payload.title !== 'undefined' && typeof payload.title !== 'string') ||
		(typeof payload.body !== 'undefined' && typeof payload.body !== 'string') ||
		payload.title?.length > 100 ||
		payload.body?.length > 1000
	) {
		throw error(400, 'Notification title or body is invalid');
	}

	let successCount = 0;
	let failCount = 0;

	const notificationPayload = JSON.stringify({
		title: payload.title ?? 'Notification',
		body: payload.body ?? ''
	});

	for (const sub of await getSubscriptions()) {
		try {
			await webpush.sendNotification(sub, notificationPayload);
			successCount++;
		} catch (err) {
			console.error('Push failed:', err);
			failCount++;
		}
	}

	return json({
		status: 'notifications sent',
		successCount,
		failCount
	});
};
