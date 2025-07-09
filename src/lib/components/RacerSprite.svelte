<script lang="ts">
	import { getCameraContext } from '$lib/stores/camera.svelte';
	import type { Racer } from '$lib/stores/racer.svelte';
	import { onMount, onDestroy } from 'svelte';

	const camera = getCameraContext();

	const {
		x = 0,
		y = 0,
		scale = 1,
		frameRate = 100,
		direction = 'down',
		racer
	}: {
		x: number;
		y: number;
		scale: number;
		frameRate: number;
		direction: 'up' | 'down' | 'left' | 'right';
		racer: Racer;
	} = $props(); //angle in radians  frameRate in ms (100 = 10 FPS)

	const frameWidth = 64;
	const frameHeight = 64;
	const columns = 4;
	const totalFrames = 16;

	let frame = 0;
	let frameX = $state(0);
	let frameY = $state(0);
	let interval: any;

	function handleMouseDown(event: MouseEvent) {
		const target: HTMLDivElement = event.target as HTMLDivElement;
		console.log('clicked racer');
		if (!target) return;

		const racerId = target.id.split('-')[1] || '-1';
		camera.mode = 'follow';
		console.log(racerId);
		camera.targetRacerId = racerId;
	}

	function getRowFromDirection(dir: string): number {
		switch (dir) {
			case 'down':
				return 0;
			case 'left':
				return 1;
			case 'right':
				return 2;
			case 'up':
				return 3;
			default:
				return 0;
		}
	}

	$effect(() => {
		frameY = getRowFromDirection(direction);
	});

	onMount(() => {
		interval = setInterval(() => {
			frame = (frame + 1) % totalFrames;
			frameX = frame % columns;
		}, frameRate);
	});

	onDestroy(() => {
		clearInterval(interval);
	});
</script>

<div
	id="racer-{racer.id}"
	role="none"
	onpointerdown={handleMouseDown}
	class="sprite"
	style="
    transform:
      translate(calc({x}px), calc({y}px))
      translate(-50%, -50%)
      scale({scale});
    background-position: {-frameX * frameWidth}px {-frameY * frameHeight}px;
    background-image: url('{racer.pokemon.spriteSheet}');
    transition: transform 1s ease-out;
    data-id={racer.id}
  "
></div>

<style>
	.sprite {
		position: absolute;
		width: 64px;
		height: 64px;
		background-size: 256px 256px;
		image-rendering: pixelated;
		z-index: 110;
		cursor: pointer;
	}
</style>
