import type { PushSubscription } from 'web-push';
import pb from './pocketbase';

export async function addSubscription(subscription: PushSubscription) {
	const endpoint = subscription.endpoint;

	// Check if a record already exists with this endpoint
	const existing = await pb
		.collection('subscriptions')
		.getFirstListItem(`endpoint="${endpoint}"`)
		.catch(() => null);

	if (!existing) {
		await pb.collection('subscriptions').create({
			endpoint: subscription.endpoint,
			keys: subscription.keys,
			expirationTime: subscription.expirationTime
		});
	}
}

export async function getSubscriptions(): Promise<PushSubscription[]> {
	const records = await pb.collection('subscriptions').getFullList();
	return records.map((record) => ({
		endpoint: record.endpoint,
		keys: record.keys,
		expirationTime: record.expirationTime
	}));
}
