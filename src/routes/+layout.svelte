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
	import '$lib/pwa.ts';
	import { setClientContext } from '$lib/stores/client.svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import Spinner from '$lib/components/Spinner.svelte';
	import { subscribeToPush } from '$lib/subscribe';
	import { getAllRacers, setRacersContext } from '$lib/stores/racer.svelte';
	import { getAllRaces, setRacesContext } from '$lib/stores/race.svelte';
	import RacerList from '$lib/components/RacerList.svelte';
	import { setRacetracksContext } from '$lib/stores/racetrack.svelte';

	let { children, data } = $props();

	const user: Partial<User> = $state(data?.user || {});
	const url = $derived(page.url.pathname);
	const urlParams = $derived(page.url.searchParams);

	//init client
	const pb = setPBContext();
	if (data.racers && data.races && data.racetracks) {
		setRacersContext(data.racers);
		setRacesContext(data.races);
		setRacetracksContext(data.racetracks);
	}

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
		await subscribeToPush();
		//set theme color (status bar on mobile devices) from base color variable
		const barColor = window.getComputedStyle(document.body).getPropertyValue('--color-base-200');
		const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
		if (themeColor) themeColor.content = barColor;
	});
</script>

{#if data.url !== '/login' && !user.options?.raceViewer?.isViewing}
	<div class="grid h-full grid-cols-1 grid-rows-[4rem_1fr_4rem]">
		<div>
			<Console />
			<TopBar />
		</div>
		{#key data.url}
			<div
				transition:fade={{ duration: 300 }}
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
