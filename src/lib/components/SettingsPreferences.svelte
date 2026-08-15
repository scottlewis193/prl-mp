<script lang="ts">
	import type { User } from '$lib/types';
	import {
		cameraModeOptions,
		leaderboardModeOptions,
		themeOptions
	} from '$lib/settingsPreferences';

	let { user }: { user: Partial<User> | null } = $props();
</script>

<form method="POST" action="?/updateAccount" class="flex flex-col gap-5">
	<label class="fieldset">
		<span class="fieldset-legend">Email</span>
		<input class="input w-full" type="email" value={user?.email ?? ''} disabled />
	</label>

	<label class="fieldset">
		<span class="fieldset-legend">Display name</span>
		<input class="input w-full" name="name" required maxlength="150" value={user?.name ?? ''} />
	</label>

	<label class="fieldset">
		<span class="fieldset-legend">Default race camera</span>
		<select class="select w-full" name="cameraMode">
			{#each cameraModeOptions as option}
				<option
					value={option.value}
					selected={(user?.options?.raceViewer?.cameraMode ?? 'free') === option.value}
				>
					{option.label}
				</option>
			{/each}
		</select>
	</label>

	<label class="fieldset">
		<span class="fieldset-legend">Leaderboard display</span>
		<select class="select w-full" name="leaderboardMode">
			{#each leaderboardModeOptions as option}
				<option
					value={option.value}
					selected={(user?.options?.raceViewer?.leaderboardMode ?? 'interval') === option.value}
				>
					{option.label}
				</option>
			{/each}
		</select>
	</label>

	<label class="fieldset">
		<span class="fieldset-legend">Theme</span>
		<select class="select w-full" name="theme">
			{#each themeOptions as option}
				<option value={option.value} selected={(user?.options?.theme ?? 'system') === option.value}>
					{option.label}
				</option>
			{/each}
		</select>
	</label>

	<fieldset class="fieldset gap-3">
		<legend class="fieldset-legend">Accessibility</legend>
		<label class="label justify-start gap-3">
			<input
				class="checkbox"
				type="checkbox"
				name="reducedMotion"
				checked={user?.options?.accessibility?.reducedMotion ?? false}
			/>
			<span>Reduce animations and transitions</span>
		</label>
		<label class="label justify-start gap-3">
			<input
				class="checkbox"
				type="checkbox"
				name="highContrast"
				checked={user?.options?.accessibility?.highContrast ?? false}
			/>
			<span>Increase interface contrast</span>
		</label>
	</fieldset>

	<div class="card-actions justify-end">
		<button class="btn btn-primary" type="submit">Save settings</button>
	</div>
</form>
