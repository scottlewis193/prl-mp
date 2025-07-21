<script lang="ts">
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext } from '$lib/stores/racer.svelte';
	import { onDestroy, onMount } from 'svelte';

	let consoleVisible = $state(false);
	let consoleInput: HTMLInputElement | null = $state(null);
	let racers = getRacersContext();
	let race = getCurrentRaceContext();

	function toggleConsoleVisibility(event: KeyboardEvent) {
		if (event.key === '`') {
			consoleVisible = !consoleVisible;
		}
	}

	async function executeCommand(command: string) {
		const response = await fetch('/commands', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ command })
		});
		const data = await response.json();
	}

	onMount(() => {
		document.addEventListener('keypress', toggleConsoleVisibility);
	});

	$effect(() => {
		if (consoleVisible) {
			consoleInput = document.getElementById('console-input') as HTMLInputElement;
			consoleInput.focus();
		}
	});
</script>

{#if consoleVisible}
	<div id="console-container" class="absolute top-0 left-0 z-[1000] flex h-8 w-full">
		<label class="input h-full w-full rounded-none border-0 bg-black text-green-500">
			prl>
			<input
				bind:this={consoleInput}
				list="commands"
				id="console-input"
				style="font-family: Consolas;"
				class="h-full w-full bg-black text-green-500"
				type="text"
				name="command"
				placeholder="Type a command '/'"
				onkeypress={(event) => {
					const input = event.target as HTMLInputElement;
					const value = input.value;
					if (event.key === 'Enter') {
						executeCommand(value);
						consoleVisible = false;
					}
				}}
				oninput={(event) => {
					//user selected command from suggestions
					const target = event.target as HTMLInputElement;
					if (target.value.slice(-1) === '\u2063') {
						console.log('user selected command from suggestions');
						if (target.value.includes('[')) {
							target.value = target.value.split('[')[0];
						} else {
							target.value = target.value.split('-')[0];
						}
					}
				}}
			/>
			<datalist id="commands">
				<option>/createrace - Creates a pending race and associated racers &#8291;</option>
				<option>/deleteallraces - Deletes all races and racers &#8291;</option>
				<option>/startrace [raceId] - Starts a race (sets status to 'running') &#8291;</option>
			</datalist>
		</label>
	</div>
{/if}
