<script lang="ts">
	import type { AuthRecord } from 'pocketbase';
	import '../app.css';
	import { onMount } from 'svelte';
	import Console from '$lib/components/Console.svelte';

	let { children } = $props();
</script>

{@render children()}
<Console />
