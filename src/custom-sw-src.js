import { precacheAndRoute } from 'workbox-precaching';

// This line is required for injectManifest to work
precacheAndRoute(self.__WB_MANIFEST);

//@ts-ignore
self.addEventListener('push', (event) => {
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
		//@ts-ignore
		self.registration.showNotification(data.title, {
			body: data.body
		})
	);
});
