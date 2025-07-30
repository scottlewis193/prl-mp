import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
	onNeedRefresh() {
		updateSW(true); // immediately update
	},
	onOfflineReady() {
		console.log('PWA is ready to work offline');
	}
});
