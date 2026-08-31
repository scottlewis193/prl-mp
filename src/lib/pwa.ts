import { registerSW } from 'virtual:pwa-register';
import { unregisterLegacyServiceWorkers } from '$lib/serviceWorkerRegistration';

async function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		await unregisterLegacyServiceWorkers(navigator.serviceWorker);
	}

	const updateSW = registerSW({
		onNeedRefresh() {
			updateSW(true); // immediately update
		},
		onOfflineReady() {
			console.log('PWA is ready to work offline');
		}
	});
}

void registerServiceWorker();
