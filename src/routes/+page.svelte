<script lang="ts">
	import { goto } from '$app/navigation';
	import type { AuthRecord } from 'pocketbase';

	let { data }: { data: { user: AuthRecord; url: string } } = $props();
	const user = data?.user;
</script>

<div class="bg-base-200 flex h-[64px] flex-col items-start justify-center pl-2 text-white">
	<div class="avatar avatar-placeholder">
		<div class="bg-neutral text-neutral-content w-12 rounded-full">
			<span>{user?.name.charAt(0).toUpperCase()}</span>
		</div>
	</div>
</div>

<div id="menu-container" class="flex h-full w-full flex-col items-center justify-center">
	<div id="logo-container" class="flex w-80 flex-col gap-2">
		<img src="/logo.png" alt="Logo" class="h-auto w-full" />
	</div>
	<div id="button-container" class="flex w-80 flex-col gap-2">
		<button class="btn w-full" onclick={() => goto('/races')}>Races</button>
		<button class="btn w-full" onclick={() => goto('/exchange')}>The Exchange</button>
		<button class="btn w-full">Exit</button>
	</div>
</div>
