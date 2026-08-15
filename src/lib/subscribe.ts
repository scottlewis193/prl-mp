export type PushNotificationState =
	| { status: 'unavailable'; message: string }
	| { status: 'unsupported'; message: string }
	| { status: 'blocked'; message: string }
	| { status: 'inactive' }
	| { status: 'expired' }
	| { status: 'active' };

type BrowserPushSubscription = {
	endpoint: string;
	expirationTime: number | null;
	toJSON(): PushSubscriptionJSON;
	unsubscribe(): Promise<boolean>;
};

export type PushClientDependencies = {
	publicKey: string;
	now(): number;
	notifications: {
		permission: NotificationPermission;
		requestPermission(): Promise<NotificationPermission>;
	} | null;
	pushManager: {
		getSubscription(): Promise<BrowserPushSubscription | null>;
		subscribe(options: PushSubscriptionOptionsInit): Promise<BrowserPushSubscription>;
	} | null;
	request(input: string, init?: RequestInit): Promise<Response>;
};

const unavailable: PushNotificationState = {
	status: 'unavailable',
	message: 'Push notifications are not configured on this server.'
};

export function isPushUnavailable(
	state: PushNotificationState
): state is Extract<PushNotificationState, { message: string }> {
	return (
		state.status === 'unavailable' || state.status === 'unsupported' || state.status === 'blocked'
	);
}

function isExpired(subscription: BrowserPushSubscription, now: number): boolean {
	return subscription.expirationTime !== null && subscription.expirationTime <= now;
}

function toSubscriptionPayload(subscription: BrowserPushSubscription) {
	const plain = subscription.toJSON();
	return {
		endpoint: subscription.endpoint,
		expirationTime: subscription.expirationTime,
		keys: {
			p256dh: plain.keys?.p256dh,
			auth: plain.keys?.auth
		}
	};
}

async function expectSuccess(response: Response): Promise<void> {
	if (!response.ok) throw new Error('Unable to update push notification subscription');
}

async function deleteServerSubscription(
	dependencies: PushClientDependencies,
	subscription: BrowserPushSubscription
): Promise<void> {
	await expectSuccess(
		await dependencies.request('/api/subscribe', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint })
		})
	);
}

export function createBrowserPushDependencies(publicKey: string): PushClientDependencies {
	const supported =
		typeof window !== 'undefined' &&
		typeof navigator !== 'undefined' &&
		'Notification' in window &&
		'serviceWorker' in navigator &&
		'PushManager' in window;

	return {
		publicKey,
		now: Date.now,
		notifications: supported
			? {
					get permission() {
						return Notification.permission;
					},
					requestPermission: () => Notification.requestPermission()
				}
			: null,
		pushManager: null,
		request: fetch
	};
}

async function resolvePushManager(
	dependencies: PushClientDependencies
): Promise<NonNullable<PushClientDependencies['pushManager']> | null> {
	if (dependencies.pushManager) return dependencies.pushManager;
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
	return (await navigator.serviceWorker.ready).pushManager;
}

export async function getPushNotificationState(
	dependencies: PushClientDependencies
): Promise<PushNotificationState> {
	if (!dependencies.publicKey) return unavailable;
	if (!dependencies.notifications) {
		return { status: 'unsupported', message: 'This browser does not support push notifications.' };
	}
	if (dependencies.notifications.permission === 'denied') {
		return {
			status: 'blocked',
			message: 'Notifications are blocked in your browser settings.'
		};
	}

	const pushManager = await resolvePushManager(dependencies);
	if (!pushManager) {
		return { status: 'unsupported', message: 'This browser does not support push notifications.' };
	}
	const subscription = await pushManager.getSubscription();
	if (!subscription) return { status: 'inactive' };
	if (isExpired(subscription, dependencies.now())) return { status: 'expired' };

	const response = await dependencies.request(
		`/api/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
		{ method: 'GET' }
	);
	if (!response.ok) throw new Error('Unable to check push notification subscription');
	const serverState = await response.json();
	return serverState.subscribed ? { status: 'active' } : { status: 'expired' };
}

export async function subscribeToPush(
	dependencies: PushClientDependencies
): Promise<PushNotificationState> {
	const state = await getPushNotificationState(dependencies);
	if (isPushUnavailable(state)) return state;

	const permission = await dependencies.notifications!.requestPermission();
	if (permission !== 'granted') {
		return {
			status: 'blocked',
			message: 'Notification permission was not granted.'
		};
	}

	const pushManager = (await resolvePushManager(dependencies))!;
	let subscription = await pushManager.getSubscription();
	if (subscription && (state.status === 'expired' || isExpired(subscription, dependencies.now()))) {
		await deleteServerSubscription(dependencies, subscription);
		await subscription.unsubscribe();
		subscription = null;
	}
	if (!subscription) {
		subscription = await pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(dependencies.publicKey)
		});
	}

	await expectSuccess(
		await dependencies.request('/api/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(toSubscriptionPayload(subscription))
		})
	);
	return { status: 'active' };
}

export async function unsubscribeFromPush(
	dependencies: PushClientDependencies
): Promise<PushNotificationState> {
	const pushManager = await resolvePushManager(dependencies);
	const subscription = await pushManager?.getSubscription();
	if (!subscription) return { status: 'inactive' };

	await deleteServerSubscription(dependencies, subscription);
	await subscription.unsubscribe();
	return { status: 'inactive' };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
