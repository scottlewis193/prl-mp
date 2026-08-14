<script lang="ts">
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getRacersContext } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';

	let consoleVisible = $state(false);
	let consoleInput: HTMLInputElement | null = $state(null);
	let outputMessage = $state('');
	let outputKind: 'success' | 'error' | null = $state(null);
	let executing = $state(false);
	let racers = getRacersContext();
	let race = getCurrentRaceContext();

	function toggleConsoleVisibility(event: KeyboardEvent) {
		if (event.key === '`') {
			event.preventDefault();
			consoleVisible = !consoleVisible;
		}
	}

	async function executeCommand(command: string) {
		executing = true;
		outputMessage = 'Executing command…';
		outputKind = null;

		try {
			const response = await fetch('/commands', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ command })
			});
			const data: { message?: unknown } = await response.json();
			outputMessage =
				typeof data.message === 'string' ? data.message : `Command failed (${response.status})`;
			outputKind = response.ok ? 'success' : 'error';
		} catch {
			outputMessage = 'Unable to reach the administrative command service';
			outputKind = 'error';
		} finally {
			executing = false;
		}
	}

	onMount(() => {
		document.addEventListener('keydown', toggleConsoleVisibility);
		return () => document.removeEventListener('keydown', toggleConsoleVisibility);
	});

	$effect(() => {
		if (consoleVisible) {
			consoleInput = document.getElementById('console-input') as HTMLInputElement;
			consoleInput?.focus();
		}
	});
</script>

{#if consoleVisible}
	<div id="console-container" class="absolute top-0 left-0 z-[9999] w-full bg-black">
		<label class="input h-8 w-full rounded-none border-0 bg-black text-green-500">
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
				disabled={executing}
				onkeydown={async (event) => {
					const input = event.target as HTMLInputElement;
					const value = input.value.trim();
					if (event.key === 'Enter' && value && !executing) {
						event.preventDefault();
						await executeCommand(value);
						input.value = '';
					}
				}}
				oninput={(event) => {
					//user selected command from suggestions
					const target = event.target as HTMLInputElement;
					if (target.value.slice(-1) === '\u2063') {
						if (target.value.includes('[')) {
							target.value = target.value.split('[')[0];
						} else {
							target.value = target.value.split('-')[0];
						}
					}
				}}
			/>
			<datalist id="commands">
				<option
					>/createracers - Recreates unassigned racers from seeded Pokémon and trainers &#8291;</option
				>
				<option>/createrace - Creates a pending race with unassigned racers &#8291;</option>
				<option>/deleteallraces --confirm - Permanently deletes all races and racers &#8291;</option
				>
				<option>/startrace [raceId] - Starts a race (sets status to 'running') &#8291;</option>
			</datalist>
		</label>
		{#if outputMessage}
			<div
				role="status"
				aria-live="polite"
				class={`px-3 py-1 font-mono text-sm ${outputKind === 'error' ? 'text-red-400' : 'text-green-500'}`}
			>
				{outputMessage}
			</div>
		{/if}
	</div>
{/if}
