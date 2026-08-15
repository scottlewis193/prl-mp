import type PocketBase from 'pocketbase';
import type { StoredPushSubscription } from './pushSubscriptionService';

function quoted(value: string): string {
	return JSON.stringify(value);
}

export function createSubscriptionRepository(pb: Pick<PocketBase, 'collection'>) {
	const collection = () => pb.collection('subscriptions');
	const findByEndpoint = (endpoint: string) =>
		collection()
			.getFirstListItem(`endpoint=${quoted(endpoint)}`)
			.catch(() => null);
	const findForPlayer = (playerId: string, endpoint: string) =>
		collection()
			.getFirstListItem(`user=${quoted(playerId)} && endpoint=${quoted(endpoint)}`)
			.catch(() => null);

	return {
		async save(playerId: string, subscription: StoredPushSubscription): Promise<void> {
			const existing = await findByEndpoint(subscription.endpoint);
			const value = { ...subscription, user: playerId };
			if (existing) {
				await collection().update(existing.id, value);
			} else {
				await collection().create(value);
			}
		},
		async remove(playerId: string, endpoint: string): Promise<void> {
			const existing = await findForPlayer(playerId, endpoint);
			if (existing) await collection().delete(existing.id);
		},
		async has(playerId: string, endpoint: string): Promise<boolean> {
			const existing = await findForPlayer(playerId, endpoint);
			return Boolean(existing);
		},
		async removeEndpoint(endpoint: string): Promise<void> {
			const existing = await findByEndpoint(endpoint);
			if (existing) await collection().delete(existing.id);
		}
	};
}
