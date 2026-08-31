<script lang="ts">
	import { page } from '$app/state';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import Console from '$lib/components/Console.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import '$lib/pwa.ts';
	import { setPBContext } from '$lib/stores/pb.svelte';
	import { getRacesContext, setRacesContext, subscribeToRaces } from '$lib/stores/race.svelte';
	import { getRacersContext, setRacersContext, subscribeToRacers } from '$lib/stores/racer.svelte';
	import { setRacetracksContext } from '$lib/stores/racetrack.svelte';

	import { onMount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import '../app.css';
	import type { User } from '$lib/types';
	import { isAdministrativeUser } from '$lib/adminAuthorization';
	import { setUserContext, syncUserContext } from '$lib/stores/user.svelte';

	let { children, data } = $props();

	const user = setUserContext((data?.user ?? {}) as Partial<User>);
	const url = $derived(page.url.pathname);

	$effect(() => {
		const latestUser = (data?.user ?? {}) as Partial<User>;
		untrack(() => syncUserContext(user, latestUser));
	});

	$effect(() => {
		const theme = user.options?.theme ?? 'system';
		if (theme === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = theme;
		document.documentElement.dataset.reducedMotion = String(
			user.options?.accessibility?.reducedMotion ?? false
		);
		document.documentElement.dataset.highContrast = String(
			user.options?.accessibility?.highContrast ?? false
		);
	});

	//init client
	const pb = setPBContext();
	if (data.racers && data.races && data.racetracks) {
		setRacersContext(data.racers);
		setRacesContext(data.races);
		setRacetracksContext(data.racetracks);
	}
	const races = getRacesContext();
	const racers = getRacersContext();

	onMount(async () => {
		pb.authStore.loadFromCookie(document.cookie);
		// PocketBase shares one EventSource across topics; let the first connection
		// settle before registering the next topic.
		await subscribeToRaces(races, pb);
		await subscribeToRacers(racers, pb);
		//set theme color (status bar on mobile devices) from base color variable
		const barColor = window.getComputedStyle(document.body).getPropertyValue('--color-base-200');
		const themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
		if (themeColor) themeColor.content = barColor;
	});
</script>

{#if data.url !== '/login' && !data.url.startsWith('/races/')}
	<div class="grid h-full grid-cols-1 grid-rows-[4rem_1fr_4rem]">
		<div>
			{#if isAdministrativeUser(data.user)}
				<Console />
			{/if}
			<TopBar />
		</div>
		{#key data.url}
			<div
				transition:fade={{ duration: 200 }}
				class={user?.options?.raceViewer?.isViewing ? 'absolute h-full w-full' : ''}
			>
				{@render children()}
			</div>
		{/key}
		<BottomBar {url} />
	</div>
{:else}
	{@render children()}
{/if}
