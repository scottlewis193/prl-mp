<script lang="ts">
	import { setCameraContext, type Camera } from '$lib/stores/camera.svelte';
	import { getRaceContext, type Race } from '$lib/stores/race.svelte';
	import { getRacersContext, type Racer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';

	const race: Race = getRaceContext();
	const racers: Racer[] = getRacersContext();
	const camera: Camera = setCameraContext();

	let windowWidth = $state(0);
	let windowHeight = $state(0);

	let trackEl: HTMLDivElement;

	let scale = $state(1);

	function updateScale() {
		if (!trackEl) return;
		windowWidth = window.innerWidth;
		windowHeight = window.innerHeight;
		scale = Math.min(windowWidth / 1280, windowHeight / 720);
		trackEl.style.transform = `scale(${scale})`;
	}

	function handleMouseDown(event: MouseEvent) {
		if (camera.mode !== 'free') return;
		camera.isPanning = true;
		camera.lastMouse = { x: event.clientX, y: event.clientY };
	}

	function handleMouseMove(event: MouseEvent) {
		if (!camera.isPanning || camera.mode !== 'free') return;

		console.log('move');
		const dx = (event.clientX - camera.lastMouse.x) / camera.zoom;
		const dy = (event.clientY - camera.lastMouse.y) / camera.zoom;

		camera.x -= dx;
		camera.y -= dy;

		camera.lastMouse = { x: event.clientX, y: event.clientY };
	}

	function handleMouseUp() {
		camera.isPanning = false;
	}

	function handleWheel(event: WheelEvent) {
		if (camera.mode !== 'free') return;

		event.preventDefault();
		const zoomFactor = 1.1;
		const direction = event.deltaY > 0 ? -1 : 1;

		const newZoom = direction > 0 ? camera.zoom * zoomFactor : camera.zoom / zoomFactor;

		// Optional: clamp zoom
		camera.zoom = Math.max(0.5, Math.min(3, newZoom));
	}

	onMount(async () => {
		updateScale();
		window.addEventListener('resize', updateScale);
	});
</script>

<div
	role="none"
	class="camera-wrapper"
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseUp}
	onwheel={handleWheel}
>
	<div
		bind:this={trackEl}
		class="track-container"
		style="
		transform:
			translate({-(camera.x * camera.zoom) + windowWidth / 2}px,
					  {-(camera.y * camera.zoom) + windowHeight / 2}px)
			scale({camera.zoom});
		transform-origin: center;
	"
	>
		<div
			style="width: 3000px; height: 3000px; background: repeating-conic-gradient(#333 0deg 10deg, #111 10deg 20deg);"
		>
			<p style="color: white; position: absolute; top: 50%; left: 50%;">Camera Center</p>
		</div>
	</div>
</div>

<style>
	.camera-wrapper {
		width: 100vw;
		height: 100vh;
		position: relative;
		overflow: hidden;
		cursor: grab;
		user-select: none;
	}
	.camera-wrapper:active {
		cursor: grabbing;
	}

	.track-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		transform-origin: center;
		will-change: transform;
	}
</style>
