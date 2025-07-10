<script lang="ts">
	import { getCameraContext } from '$lib/stores/camera.svelte';
	let { children } = $props();

	const camera = getCameraContext();

	function handleMouseDown(event: MouseEvent) {
		if (camera.mode !== 'free') return;
		camera.isPanning = true;
		camera.lastMouse = { x: event.clientX, y: event.clientY };
	}

	function handleMouseMove(event: MouseEvent) {
		if (camera.mode !== 'free' || !camera.isPanning) return;

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
</script>

<div
	style="pointer-events: {camera.mode == 'free' ? 'auto' : 'none'};"
	role="none"
	class="camera-wrapper"
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
	onmousemove={handleMouseMove}
	onwheel={handleWheel}
>
	{@render children()}
</div>

<style>
	.camera-wrapper {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		position: relative;
		cursor: grab;
		grid-column-start: 2;
		grid-row-start: 2;
	}

	.camera-wrapper:active {
		cursor: grabbing;
	}
</style>
