// src/routes/api/notify/+server.ts
import { json, type RequestHandler } from '@sveltejs/kit';
import webpush from 'web-push';

import { URL, VAPID_PRIVATE_KEY } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import { getSubscriptions } from '$lib/server/subscriptions'; // your own subscription store

webpush.setVapidDetails('mailto:you@example.com', PUBLIC_VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.json(); // e.g. { title: 'Hello', body: 'Test' }

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
