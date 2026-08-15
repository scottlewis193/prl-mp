export type StoredPushSubscription = {
	endpoint: string;
	expirationTime: number | null;
	keys: { p256dh: string; auth: string };
};

type PushSubscriptionServiceDependencies = {
	configured: boolean;
	publicKey: string;
	save(playerId: string, subscription: StoredPushSubscription): Promise<void>;
	remove(playerId: string, endpoint: string): Promise<void>;
	has(playerId: string, endpoint: string): Promise<boolean>;
};

export class PushSubscriptionServiceError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

function requirePlayer(playerId: string | null | undefined): string {
	if (!playerId) throw new PushSubscriptionServiceError('Sign in to manage notifications.', 401);
	return playerId;
}

function validEndpoint(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

function parseSubscription(value: unknown): StoredPushSubscription {
	if (!value || typeof value !== 'object') {
		throw new PushSubscriptionServiceError('Enter a valid push subscription.', 400);
	}
	const candidate = value as Partial<StoredPushSubscription>;
	if (
		!validEndpoint(candidate.endpoint) ||
		!candidate.keys ||
		typeof candidate.keys.p256dh !== 'string' ||
		!candidate.keys.p256dh ||
		typeof candidate.keys.auth !== 'string' ||
		!candidate.keys.auth ||
		(candidate.expirationTime !== null && typeof candidate.expirationTime !== 'number')
	) {
		throw new PushSubscriptionServiceError('Enter a valid push subscription.', 400);
	}

	return {
		endpoint: candidate.endpoint,
		expirationTime: candidate.expirationTime ?? null,
		keys: { p256dh: candidate.keys.p256dh, auth: candidate.keys.auth }
	};
}

export function createPushSubscriptionService(dependencies: PushSubscriptionServiceDependencies) {
	const unavailable = () =>
		new PushSubscriptionServiceError('Push notifications are not configured on this server.', 503);
	const subscriptionTarget = (playerId: string | null | undefined, endpoint: unknown) => {
		if (!dependencies.configured) throw unavailable();
		if (!validEndpoint(endpoint)) {
			throw new PushSubscriptionServiceError('Enter a valid push subscription endpoint.', 400);
		}
		return { playerId: requirePlayer(playerId), endpoint };
	};

	return {
		configuration() {
			return dependencies.configured
				? { available: true as const, publicKey: dependencies.publicKey }
				: {
						available: false as const,
						reason: 'Push notifications are not configured on this server.'
					};
		},
		async subscribe(playerId: string | null | undefined, value: unknown) {
			if (!dependencies.configured) throw unavailable();
			await dependencies.save(requirePlayer(playerId), parseSubscription(value));
			return { status: 'subscribed' as const };
		},
		async unsubscribe(playerId: string | null | undefined, endpoint: unknown) {
			const target = subscriptionTarget(playerId, endpoint);
			await dependencies.remove(target.playerId, target.endpoint);
			return { status: 'unsubscribed' as const };
		},
		async status(playerId: string | null | undefined, endpoint: unknown) {
			const target = subscriptionTarget(playerId, endpoint);
			return { subscribed: await dependencies.has(target.playerId, target.endpoint) };
		}
	};
}
