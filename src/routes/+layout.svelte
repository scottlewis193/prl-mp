<script lang="ts">
	import type { AuthRecord } from 'pocketbase';
	import '../app.css';
	import { onDestroy, onMount } from 'svelte';
	import Console from '$lib/components/Console.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fade, fly } from 'svelte/transition';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { setRacesContext, subscribeToRaces, unsubscribeFromRaces } from '$lib/stores/race.svelte';
	import {
		setRacersContext,
		subscribeToRacers,
		unsubscribeFromRacers
	} from '$lib/stores/racer.svelte';
	import PocketBase from 'pocketbase';
	import { setUserContext, type User } from '$lib/stores/user.svelte';
	import pb from '$lib/pocketbase';

	let { children, data } = $props();
	const user: Partial<User> = $state(data?.user || {});
	const url = $derived(page.url.pathname);
	const urlParams = $derived(page.url.searchParams);

	const races = setRacesContext(data.races);
	const racers = setRacersContext(data.racers);
	const _user = setUserContext(user);

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
		await subscribeToRaces(races, pb);
		await subscribeToRacers(racers, pb);
	});

	// onDestroy(() => {
	// 	unsubscribeFromRacers(pb);
	// 	unsubscribeFromRaces(pb);
	// });
</script>

<Console />

{#if !_user.options?.raceViewer?.isViewing}
	<div
		class="bg-base-200 fixed z-[1000] flex h-16 w-full items-center justify-start pl-2 text-white"
	>
		<div class="flex flex-1/2 items-center justify-start gap-2">
			<div id="logo-container" class="flex h-[64px] w-10 flex-col justify-center gap-2">
				<img src="/logo.png" alt="Logo" class="h-auto w-full" />
			</div>
			<!-- <label class="input input-sm">
			<span class="label">₽</span>
			<input type="text" placeholder="URL" />
		</label> -->
		</div>
		<div class="flex flex-1/2 items-center justify-end gap-2 pr-2">
			<details class="dropdown dropdown-end">
				<summary class="list-none">
					<div class="avatar avatar-placeholder">
						<div class="bg-neutral text-neutral-content w-12 rounded-full">
							<span>{user?.name?.charAt(0).toUpperCase()}</span>
						</div>
					</div></summary
				>
				<ul class="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
					<li><a>Profile</a></li>
					<li><a>Logout</a></li>
				</ul>
			</details>
		</div>
	</div>
{/if}
{#key data.url}
	<div
		class={!_user?.options?.raceViewer.isViewing
			? 'absolute top-16 h-[calc(100%-8rem)]  w-full'
			: ''}
		transition:fade={{ duration: 300 }}
	>
		{@render children()}
	</div>
{/key}
<!--
		in:fly={{ x: transitionDirection === 'right' ? -200 : 200, duration: 300, delay: 300 }}
		--
	>
		<!-- out:fly={{ x: transitionDirection === 'right' ? 200 : -200, duration: 300 }} -->
>
{#if !_user?.options?.raceViewer.isViewing}
	<div class="dock">
		<button
			onclick={() => {
				goto('/');
			}}
			class={url == '/' ? 'dock-active' : ''}
		>
			<svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
				><g fill="currentColor" stroke-linejoin="miter" stroke-linecap="butt"
					><polyline
						points="1 11 12 2 23 11"
						fill="none"
						stroke="currentColor"
						stroke-miterlimit="10"
						stroke-width="2"
					></polyline><path
						d="m5,13v7c0,1.105.895,2,2,2h10c1.105,0,2-.895,2-2v-7"
						fill="none"
						stroke="currentColor"
						stroke-linecap="square"
						stroke-miterlimit="10"
						stroke-width="2"
					></path><line
						x1="12"
						y1="22"
						x2="12"
						y2="18"
						fill="none"
						stroke="currentColor"
						stroke-linecap="square"
						stroke-miterlimit="10"
						stroke-width="2"
					></line></g
				></svg
			>
			<span class="dock-label">Home</span>
		</button>

		<button
			onclick={() => {
				goto('/races');
			}}
			class={url.startsWith('/races') ? 'dock-active' : ''}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
				/>
			</svg>

			<span class="dock-label">Races</span>
		</button>
		<button
			onclick={() => {
				goto('/wager');
			}}
			class={url == '/wager' ? 'dock-active' : ''}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
				/>
			</svg>

			<span class="dock-label">Wager</span>
		</button>
		<button
			onclick={() => {
				goto('/exchange');
			}}
			class={url == '/exchange' ? 'dock-active' : ''}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
				/>
			</svg>

			<span class="dock-label">Exchange</span>
		</button>
		<button
			onclick={() => {
				goto('/settings');
			}}
			class={url == '/settings' ? 'dock-active' : ''}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
				/>
			</svg>

			<span class="dock-label">Settings</span>
		</button>
	</div>
{/if}
