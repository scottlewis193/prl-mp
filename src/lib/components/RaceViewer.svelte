<script lang="ts">
	import { getFirstRace, getRace, getRaceContext, type Race } from '$lib/stores/race.svelte';
	import { getRacersContext, type Racer } from '$lib/stores/racer.svelte';
	import { onMount } from 'svelte';
	import RacerSprite from './RacerSprite.svelte';
	import LeaderBoard from './LeaderBoard.svelte';
	import { setCameraContext, type Camera } from '$lib/stores/camera.svelte';
	import CameraWrapper from './CameraWrapper.svelte';
	import PocketBase from 'pocketbase';
	import TrackRenderer from './TrackRenderer.svelte';

	const race: Race = getRaceContext();
	const racers: Racer[] = getRacersContext();
	const camera: Camera = setCameraContext();
	const checkpoints: Record<string, { x: number; y: number }> = $derived(
		race.racetrack.checkpoints
	);

	let trackEl: HTMLDivElement;
	let windowWidth = $state(0);
	let windowHeight = $state(0);
	let isDragging = $state(false);

	function getInterpolatedPosition(racer: Racer) {
		if (!race) return { x: 0, y: 0 };

		const i = racer.checkpointIndex;
		const a = checkpoints[i];
		const b = checkpoints[(i + 1) % Object.values(checkpoints).length];

		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const segmentLength = Math.hypot(dx, dy);

		const t = Math.min(racer.distanceFromCheckpoint / segmentLength, 1);

		// Centerline position
		const cx = a.x + dx * t;
		const cy = a.y + dy * t;

		// Unit perpendicular vector to (dx, dy)
		const nx = -dy / segmentLength;
		const ny = dx / segmentLength;

		const offset = ((racer.trackOffset ?? 0) * race.racetrack.width || 64) / 2;

		return {
			x: cx + nx * offset,
			y: cy + ny * offset
		};
	}

	function getAngle(racer: Racer): number {
		const i = racer.checkpointIndex;
		const a = race?.racetrack.checkpoints[i] || { x: 0, y: 0 };
		const b = race?.racetrack.checkpoints[i + 1] || a;
		return Math.atan2(b.y - a.y, b.x - a.x); // radians
	}

	function updateRacerOnScreen(updated: Racer) {
		const i = racers.findIndex((r) => r.id === updated.id);
		if (i === -1) {
			racers.push(updated);
		} else {
			racers[i] = updated;
		}
	}

	function getDirectionFromAngle(angle: number): 'up' | 'down' | 'left' | 'right' {
		const deg = (angle * 180) / Math.PI;
		const normalized = (deg + 360) % 360;

		if (normalized >= 45 && normalized < 135) return 'down';
		if (normalized >= 135 && normalized < 225) return 'left';
		if (normalized >= 225 && normalized < 315) return 'up';
		return 'right';
	}

	let scale = 1;

	function updateScale() {
		windowWidth = window.innerWidth + 300;
		windowHeight = window.innerHeight + 64;
		scale = Math.min(windowWidth / 1280, windowHeight / 720);
		const trackEl = document.getElementById('track-container');
		if (!trackEl) return;
		trackEl.style.transform = `scale(${scale})`;
	}

	// Free camera movement (e.g., via arrow keys or drag)
	function moveCamera(dx: number, dy: number) {
		if (camera.mode === 'free') {
			camera.x += dx;
			camera.y += dy;
		}
	}

	// Zoom logic
	function setZoom(factor: number) {
		camera.zoom = factor;
	}

	let lastTime = performance.now();
	let rafId: number | null = null;
	function followRacerSmoothly(followedRacer: Racer) {
		if (rafId !== null) cancelAnimationFrame(rafId);

		function tick(now: number) {
			const dt = (now - lastTime) / 1000;
			lastTime = now;

			if (camera.mode === 'follow' && followedRacer) {
				const target = getInterpolatedPosition(followedRacer);
				const targetZoom = 1.5;
				const lerpFactor = 5 * targetZoom;
				const zoomLerpFactor = 0.1;

				camera.x += (target.x - camera.x) * dt * lerpFactor;
				camera.y += (target.y - camera.y) * dt * lerpFactor;
				camera.zoom += (targetZoom - camera.zoom) * dt * zoomLerpFactor;

				//round pixel positions
				camera.x = Math.round(camera.x * 100) / 100;
				camera.y = Math.round(camera.y * 100) / 100;
			}

			rafId = requestAnimationFrame(tick);
		}

		rafId = requestAnimationFrame(tick);
	}

	onMount(async () => {
		updateScale();
		window.addEventListener('resize', updateScale);

		const pb = new PocketBase('http://localhost:8090');
		pb.authStore.loadFromCookie(document.cookie);

		await pb.collection('racers').subscribe('*', async function (e) {
			if (e.action === 'update') {
				const racerRecord = e.record as unknown as Racer;
				if (racerRecord.raceId == race.id) {
					updateRacerOnScreen(racerRecord);
				}
			}
		});
	});

	$effect(() => {
		if (camera.mode === 'follow' && camera.targetRacerId) {
			const racer = racers.find((racer) => racer.id === camera.targetRacerId);
			followRacerSmoothly(racer || racers[0]);
		}
	});
</script>

{#if race?.startTime !== '' && race}
	<!-- <Debug /> -->
	<LeaderBoard />
	<CameraWrapper>
		<div
			id="track-container"
			class="track-container"
			bind:this={trackEl}
			style="
			top: 0;
			left: 0;
				transform:
					translate({windowWidth / 2 - camera.x * camera.zoom}px, {windowHeight / 2 -
				camera.y * camera.zoom}px)
					scale({camera.zoom});
				transform-origin: top left;
				pointer-events: auto;
				width: {race.racetrack.maxSize.x}px;
				height: {race.racetrack.maxSize.y}px;
				will-change: transform;
				position: absolute;
				pointer-events: none;
				background-color: black;
				transition: transform 0.5s ease;
			"
		>
			{#each racers as racer (racer.id)}
				{#key racer.id}
					<RacerSprite
						x={getInterpolatedPosition(racer).x}
						y={getInterpolatedPosition(racer).y}
						scale={1}
						frameRate={racer.pokemon.speed * 1.5}
						direction={getDirectionFromAngle(getAngle(racer))}
						{racer}
					/>
				{/key}
			{/each}

			<TrackRenderer racetrack={race.racetrack} />
		</div>
	</CameraWrapper>
	<div
		id="camera-controls"
		class="absolute bottom-0 left-0 z-100 flex h-[64px] w-full items-center justify-center gap-3 p-4 text-white"
	>
		<button class="btn btn-neutral" onclick={() => (camera.mode = 'free')}>Free Camera</button>
		<button
			class="btn btn-neutral"
			onclick={() => {
				camera.mode = 'follow';
				camera.targetRacerId = racers[0].id;
			}}>Follow Camera</button
		>
	</div>
{/if}
