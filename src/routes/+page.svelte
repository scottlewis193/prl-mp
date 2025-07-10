<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div id="menu-container" class="flex h-full w-full flex-col items-center justify-center">
	<div id="logo-container" class="flex w-80 flex-col gap-2">
		<img src="/logo.png" alt="Logo" class="h-auto w-full" />
	</div>
	<div id="button-container" class="flex w-80 flex-col gap-2">
		<button class="btn w-full" onclick={() => goto('/raceviewer')}>Race Viewer</button>
		<button class="btn w-full" onclick={() => goto('/exchange')}>The Exchange</button>
		<button class="btn w-full">Exit</button>
	</div>
</div>
