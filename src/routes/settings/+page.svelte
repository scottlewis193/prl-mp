<script lang="ts">
	import { getUserContext } from '$lib/stores/user.svelte';
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

			<form method="POST" action="?/updateAccount" class="flex flex-col gap-5">
				<label class="fieldset">
					<span class="fieldset-legend">Email</span>
					<input class="input w-full" type="email" value={user?.email ?? ''} disabled />
				</label>

				<label class="fieldset">
					<span class="fieldset-legend">Display name</span>
					<input
						class="input w-full"
						name="name"
						required
						maxlength="150"
						value={user?.name ?? ''}
					/>
				</label>

				<label class="fieldset">
					<span class="fieldset-legend">Leaderboard display</span>
					<select class="select w-full" name="leaderboardMode">
						<option
							value="interval"
							selected={(user?.options?.raceViewer?.leaderboardMode ?? 'interval') === 'interval'}
							>Time intervals</option
						>
						<option
							value="leader"
							selected={user?.options?.raceViewer?.leaderboardMode === 'leader'}
							>Distance from leader</option
						>
					</select>
				</label>

				<div class="card-actions justify-end">
					<button class="btn btn-primary" type="submit">Save settings</button>
				</div>
			</form>
		</div>
	</div>
</div>
