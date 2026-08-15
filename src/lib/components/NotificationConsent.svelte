<script lang="ts">
	import { isPushUnavailable, type PushNotificationState } from '$lib/subscribe';

	type ConsentState = PushNotificationState | { status: 'checking' } | { status: 'working' };
	type UnavailableConsentState = Extract<PushNotificationState, { message: string }>;

	function isUnavailableConsentState(state: ConsentState): state is UnavailableConsentState {
		if (state.status === 'checking' || state.status === 'working') return false;
		return isPushUnavailable(state);
	}

	let {
		state,
		onsubscribe = () => {},
		onunsubscribe = () => {}
	}: {
		state: ConsentState;
		onsubscribe?: () => void;
		onunsubscribe?: () => void;
	} = $props();
</script>

<section class="flex flex-col gap-3" aria-labelledby="notification-settings-heading">
	<div>
		<h2 id="notification-settings-heading" class="text-xl font-semibold">Race notifications</h2>
		<p class="text-base-content/70">
			Choose whether this browser can receive race updates. Permission is requested only when you
			select Enable notifications.
		</p>
	</div>

	{#if isUnavailableConsentState(state)}
		<div class="alert alert-info" role="status"><span>{state.message}</span></div>
		<button class="btn" type="button" disabled>Enable notifications</button>
	{:else if state.status === 'active'}
		<div class="alert alert-success" role="status"><span>Notifications are enabled.</span></div>
		<button class="btn" type="button" onclick={onunsubscribe}>Disable notifications</button>
	{:else if state.status === 'expired'}
		<div class="alert alert-info" role="status">
			<span>Your notification subscription expired. Enable it again to reconnect.</span>
		</div>
		<button class="btn btn-primary" type="button" onclick={onsubscribe}>Enable again</button>
	{:else}
		{#if state.status === 'inactive'}
			<p class="text-base-content/70" role="status">Notifications are disabled.</p>
		{/if}
		<button
			class="btn btn-primary"
			type="button"
			disabled={state.status === 'checking' || state.status === 'working'}
			onclick={onsubscribe}
		>
			{state.status === 'checking' ? 'Checking availability…' : 'Enable notifications'}
		</button>
	{/if}
</section>
