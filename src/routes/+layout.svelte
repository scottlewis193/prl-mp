<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Console from '$lib/components/Console.svelte';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { type User } from '$lib/stores/user.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import { setPBContext } from '$lib/stores/pb.svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children, data } = $props();
	let webManifest = $state(pwaInfo ? pwaInfo?.webManifest.linkTag : '');
	const user: Partial<User> = $state(data?.user || {});
	const url = $derived(page.url.pathname);
	const urlParams = $derived(page.url.searchParams);
	const pb = setPBContext();
	const PATHNAME_INDEXES: { [key: string]: number } = {
		'/': 0,
		'/races': 1,
		'/exchange': 2,
		'/settings': 3
	};
	let transitionDirection: 'left' | 'right' = $state('right');

	function setTransitionDirection(newPathName: string) {
		const oldIndex = PATHNAME_INDEXES[url];
		const newIndex = PATHNAME_INDEXES[newPathName];
		transitionDirection = oldIndex > newIndex ? 'right' : 'left';
	}

	onMount(async () => {
		pb.authStore.loadFromCookie(document.cookie);
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r) {
					// uncomment following code if you want check for updates
					// r && setInterval(() => {
					//    console.log('Checking for sw update')
					//    r.update()
					// }, 20000 /* 20s for testing purposes */)
					console.log(`SW Registered: ${r}`);
				},
				onRegisterError(error) {
					console.log('SW registration error', error);
				}
			});
		}
	});
</script>

<svelte:head>
	{@html webManifest}
</svelte:head>

<div class="grid h-full grid-cols-1 grid-rows-[4rem_1fr_4rem]">
	<div>
		<Console />
		{#if !user.options?.raceViewer?.isViewing}
			{#if data.url !== '/login'}
				<TopBar />
			{/if}
		{/if}
	</div>
	{#key data.url}
		<div
			transition:fade={{ duration: 300 }}
			class={user?.options?.raceViewer.isViewing ? 'absolute h-full w-full' : ''}
		>
			{@render children()}
		</div>
	{/key}

	{#if !user?.options?.raceViewer.isViewing}
		{#if data.url !== '/login'}
			<BottomBar {url} />
		{/if}
	{/if}
</div>
