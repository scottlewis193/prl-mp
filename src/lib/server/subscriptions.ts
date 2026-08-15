import type { PushSubscription } from 'web-push';
import pb from './pocketbase';
import { createSubscriptionRepository } from './subscriptionRepository';

const repository = createSubscriptionRepository(pb);

export const saveSubscription = repository.save;
export const removeSubscription = repository.remove;
export const hasSubscription = repository.has;
export const removeSubscriptionByEndpoint = repository.removeEndpoint;

export async function getSubscriptions(): Promise<PushSubscription[]> {
	const records = await pb.collection('subscriptions').getFullList();
	return records.map((record) => ({
		endpoint: record.endpoint,
		keys: record.keys,
		expirationTime: record.expirationTime
	}));
}
