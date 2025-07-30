import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';

export async function subscribeToPush() {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return;

	const registration = await navigator.serviceWorker.ready;

	const existingSubscription = await registration.pushManager.getSubscription();

	// Format helper
	const formatSubscription = (sub: PushSubscription) => {
		const plain = sub.toJSON();
		return {
			endpoint: plain.endpoint,
			expirationTime: sub.expirationTime ?? null,
			keys: {
				p256dh: plain?.keys?.p256dh,
				auth: plain?.keys?.auth
			}
		};
	};

	// Reuse or create subscription
	const subscription =
		existingSubscription ||
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY)
		}));

	// Send to your /api/subscribe endpoint
	await fetch('/api/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(formatSubscription(subscription))
	});
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
