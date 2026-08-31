/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';

/** @type {ServiceWorkerGlobalScope & { __WB_MANIFEST: import('workbox-build').ManifestEntry[] }} */
const serviceWorker = /** @type {any} */ (self);

// This line is required for injectManifest to work
// @ts-expect-error Workbox replaces this injected manifest token during the production build.
precacheAndRoute(self.__WB_MANIFEST);

serviceWorker.addEventListener('push', (event) => {
	console.log('push event!');
	let data = {
		title: 'Default Title',
		body: 'Default Body'
	};
	if (event.data) {
		try {
			data = event.data.json();
		} catch (err) {
			console.error('Error parsing push event data:', err);
		}
	}

	event.waitUntil(
		serviceWorker.registration.showNotification(data.title, {
			body: data.body
		})
	);
});
