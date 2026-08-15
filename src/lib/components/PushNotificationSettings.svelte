<script lang="ts">
	import {
		createBrowserPushDependencies,
		getPushNotificationState,
		subscribeToPush,
		unsubscribeFromPush,
		type PushClientDependencies,
		type PushNotificationState
	} from '$lib/subscribe';
	import { onMount } from 'svelte';
	import NotificationConsent from './NotificationConsent.svelte';

	type ViewState = PushNotificationState | { status: 'checking' } | { status: 'working' };

	let state = $state<ViewState>({ status: 'checking' });
	let dependencies: PushClientDependencies | null = null;

	onMount(async () => {
		try {
			const response = await fetch('/api/subscribe');
			if (!response.ok) throw new Error('Unable to check notification availability.');
			const configuration = await response.json();
			if (!configuration.available) {
				state = { status: 'unavailable', message: configuration.reason };
				return;
			}
			dependencies = createBrowserPushDependencies(configuration.publicKey);
			state = await getPushNotificationState(dependencies);
		} catch {
			state = {
				status: 'unavailable',
				message: 'Notification settings are temporarily unavailable.'
			};
		}
	});

	async function subscribe() {
		if (!dependencies) return;
		state = { status: 'working' };
		try {
			state = await subscribeToPush(dependencies);
		} catch {
			state = { status: 'inactive' };
		}
	}

	async function unsubscribe() {
		if (!dependencies) return;
		state = { status: 'working' };
		try {
			state = await unsubscribeFromPush(dependencies);
		} catch {
			state = { status: 'active' };
		}
	}
</script>

<NotificationConsent {state} onsubscribe={subscribe} onunsubscribe={unsubscribe} />
