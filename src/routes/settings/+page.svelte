<script lang="ts">
	import { getUserContext } from '$lib/stores/user.svelte';
	import SettingsPreferences from '$lib/components/SettingsPreferences.svelte';
	import PushNotificationSettings from '$lib/components/PushNotificationSettings.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const user = getUserContext();
</script>

<div class="flex h-full w-full justify-center overflow-y-auto p-4">
	<div class="card bg-base-200 h-fit w-full max-w-2xl shadow-sm">
		<div class="card-body gap-6">
			<div>
				<h1 class="card-title text-2xl">Account settings</h1>
				<p class="text-base-content/70">Manage your player profile and race viewer preferences.</p>
			</div>

			{#if form?.error}
				<div class="alert alert-error"><span>{form.error}</span></div>
			{:else if form?.success}
				<div class="alert alert-success"><span>Account settings saved.</span></div>
			{/if}

			<SettingsPreferences {user} />

			<div class="divider"></div>
			<PushNotificationSettings />
		</div>
	</div>
</div>
