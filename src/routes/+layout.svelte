<script lang="ts">
	import { page } from '$app/state';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Console from '$lib/components/Console.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import '$lib/pwa.ts';
	import { setPBContext } from '$lib/stores/pb.svelte';
	import { setRacesContext } from '$lib/stores/race.svelte';
	import { setRacersContext } from '$lib/stores/racer.svelte';
	import { setRacetracksContext } from '$lib/stores/racetrack.svelte';

	import { subscribeToPush } from '$lib/subscribe';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import '../app.css';
	import type { User } from '$lib/types';

	let { children, data } = $props();

	const user: Partial<User> = $state(data?.user || {});
	const url = $derived(page.url.pathname);

	//init client
	const pb = setPBContext();
	if (data.racers && data.races && data.racetracks) {
		setRacersContext(data.racers);
		setRacesContext(data.races);
		setRacetracksContext(data.racetracks);
	}

	onMount(async () => {
		pb.authStore.loadFromCookie(document.cookie);
		await subscribeToPush();
		//set theme color (status bar on mobile devices) from base color variable
		const barColor = window.getComputedStyle(document.body).getPropertyValue('--color-base-200');
		const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
		if (themeColor) themeColor.content = barColor;
	});
</script>

{#if data.url !== '/login' && !data.url.startsWith('/races/')}
	<div class="grid h-full grid-cols-1 grid-rows-[4rem_1fr_4rem]">
		<div>
			<Console />
			<TopBar />
		</div>
		{#key data.url}
			<div
				transition:fade={{ duration: 200 }}
				class={user?.options?.raceViewer.isViewing ? 'absolute h-full w-full' : ''}
			>
				{@render children()}
			</div>
		{/key}
		<BottomBar {url} />
	</div>
{:else}
	{@render children()}
{/if}
