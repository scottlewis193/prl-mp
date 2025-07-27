<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Application, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

	import { getCameraContext } from '$lib/stores/camera.svelte';
	import { getCurrentRaceContext, type Race } from '$lib/stores/race.svelte';
	import { getCurrentRacersContext, type Racer } from '$lib/stores/racer.svelte';
	import { getCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';

	let { tilesetUrl, isPreview = false }: { tilesetUrl: string; isPreview?: boolean } = $props();

	const race = getCurrentRaceContext();
	const racetrack = getCurrentRacetrackContext();

	const racers = getCurrentRacersContext();
	const camera = getCameraContext();

	const checkpoints: { index: number; x: number; y: number }[] = $state([]);

	const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

	let isDragging = false;
	let dragStart = { x: 0, y: 0 };

	function updateCamera() {
		container.scale.set(camera.zoom);
		container.x = camera.x;
		container.y = camera.y;
	}

	let canvasEl: HTMLCanvasElement;

	const TILE_WIDTH = 16;
	const TILE_HEIGHT = 16;
	const TILESET_WIDTH = 2240;
	const TILES_PER_ROW = TILESET_WIDTH / TILE_WIDTH;
	const FIRST_GID = 1;

	let fps = $state(60);
	let app: Application;
	let container: Container;
	let ready = false;
	const touch: { pinchStart: number; isScaling: boolean; distance: number } = {
		pinchStart: 0,
		isScaling: false,
		distance: 0
	};

	onMount(async () => {
		if (isPreview) return;
		app = new Application();

		await app.init({
			canvas: canvasEl,
			resizeTo: isPreview && canvasEl.parentElement ? canvasEl.parentElement : window,
			backgroundColor: 0x000000,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true,
			antialias: false
		});

		container = new Container();
		app.stage.addChild(container);

		//set default camera position
		if (isPreview) {
			const zoom = (racetrack.data.width - 376 / ((racetrack.data.width + 376) / 2)) / 100;

			camera.zoom = Number(zoom.toFixed(1));
			updateCamera();
		}

		//setup track
		await setupTrack();

		//setup racers
		await setupRacers();
		ready = true;

		addListeners();

		startTicker();
	});

	onDestroy(() => {
		if (app) {
			app.destroy(true, { children: true, texture: true, context: true });
		}
	});

	function addListeners() {
		console.log('addListeners');
		if (isPreview) return;
		canvasEl.addEventListener('mousedown', (e) => {
			if (camera.mode !== 'free') return;
			isDragging = true;
			dragStart = { x: e.clientX, y: e.clientY };
		});

		canvasEl.addEventListener('touchstart', (e) => {
			if (camera.mode !== 'free') return;
			if (e.touches.length === 2) {
				touch.pinchStart = Math.hypot(
					e.touches[0].pageX - e.touches[1].pageX,
					e.touches[0].pageY - e.touches[1].pageY
				);
				touch.isScaling = true;
			} else {
				isDragging = true;
				dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
			}
		});

		window.addEventListener('mousemove', (e) => {
			if (!isDragging) return;

			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;

			camera.x += dx;
			camera.y += dy;

			dragStart = { x: e.clientX, y: e.clientY };
			updateCamera();
		});

		window.addEventListener('touchmove', (e) => {
			if (touch.isScaling) {
				touch.distance = Math.hypot(
					e.touches[0].pageX - e.touches[1].pageX,
					e.touches[0].pageY - e.touches[1].pageY
				);

				const change = touch.distance - touch.pinchStart;
				touchPinch(change);

				// if (touch.pinchStart >= 200 && touch.distance <= 90) touchPinchOut(); //call function for pinchOut
				// if (touch.pinchStart <= 100 && touch.distance >= 280) touchPinchIn(); //call function for pinchIn
			} else {
				if (!isDragging) return;

				const dx = e.touches[0].clientX - dragStart.x;
				const dy = e.touches[0].clientY - dragStart.y;

				camera.x += dx;
				camera.y += dy;

				dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
				updateCamera();
			}
		});

		window.addEventListener('touchcancel', (e) => {
			touch.isScaling = false;
		});

		window.addEventListener('mouseup', () => {
			isDragging = false;
		});

		window.addEventListener('touchend', () => {
			if (touch.isScaling) touch.isScaling = false;
			isDragging = false;
		});

		canvasEl.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault();
				const zoomAmount = e.deltaY * -0.001;
				camera.zoom = Math.max(0.2, Math.min(4, camera.zoom + zoomAmount));
				updateCamera();
			},
			{ passive: false }
		);
	}

	function touchPinch(change: number) {
		camera.zoom = Math.max(0.2, camera.zoom + change / 10000);
		updateCamera();
	}

	function startTicker() {
		if (!app || !ready) {
			console.log('not ready');
			return;
		}
		console.log('startTicker');

		app.ticker.add((ticker) => {
			fps = Math.round(ticker.FPS);

			for (const racer of racers) {
				if (!racer._frames || !racer._pixiSprite) continue;
				// Frame animation timing
				const durations: number[] = racer._frameDurations ?? [8, 8, 6, 4, 4, 4]; // frames at 60fps
				const frameCount = durations.length;

				// Initialize time tracking if missing
				if (racer._frameElapsed === undefined) racer._frameElapsed = 0;

				racer._frameElapsed += ticker.deltaMS;

				const currentDuration = durations[racer._frame] * (1000 / 60); // Convert to ms

				if (racer._frameElapsed >= currentDuration) {
					racer._frameElapsed %= currentDuration; // keep leftover time
					racer._frame = (racer._frame + 1) % frameCount;
				}

				// Set sprite based on direction and frame
				const angle = getAngle(racer);
				const fx = racer._frame;
				const fy = angleTo8DirectionIndex(angle);
				const frameIndex = fy * frameCount + fx;

				if (racer._frames[frameIndex]) {
					racer._pixiSprite.texture = racer._frames[frameIndex];
				}

				// Smooth interpolation based on time
				const now = performance.now();
				const duration = racer._interpDuration || 500;

				const t = clamp((now - racer._interpStartTime) / duration, 0, 1);

				racer._displayX = lerp(racer._lastTargetX, racer._targetX, t);
				racer._displayY = lerp(racer._lastTargetY, racer._targetY, t);

				racer._pixiSprite.x = racer._displayX;
				racer._pixiSprite.y = racer._displayY;

				if (racers[0] === racer) {
					// console.log('racer:', racer._interpStartTime, racer._lastTargetX, racer._lastTargetY);
				}

				if (camera.mode === 'follow' && camera.targetRacerId === racer.id) {
					camera.x = app.screen.width / 2 - racer._displayX;
					camera.y = app.screen.height / 2 - racer._displayY;
					updateCamera();
				}
			}
		});
	}

	function clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value));
	}

	async function setupTrack() {
		console.log('setupTrack');
		const tileset = await Assets.load({
			src: tilesetUrl,
			data: { scaleMode: 'nearest', roundPixels: true }
		});
		for (const layer of racetrack.data.layers) {
			//get checkpoints
			if (layer.name.toLowerCase() == 'checkpoints') {
				for (const object of layer?.objects || []) {
					checkpoints.push({ index: Number(object.name), x: object.x, y: object.y });
				}
				checkpoints.sort((a, b) => a.index - b.index);
				continue;
			}

			if (layer.type !== 'tilelayer' || !layer.chunks) continue;
			for (const chunk of layer.chunks) {
				const { x: chunkX, y: chunkY, width, data } = chunk;

				for (let i = 0; i < data.length; i++) {
					const gid = data[i];
					if (gid === 0) continue;

					const localX = i % width;
					const localY = Math.floor(i / width);

					const tileX = (chunkX + localX) * TILE_WIDTH;
					const tileY = (chunkY + localY) * TILE_HEIGHT;

					const texIndex = gid - FIRST_GID;
					const sx = (texIndex % TILES_PER_ROW) * TILE_WIDTH;
					const sy = Math.floor(texIndex / TILES_PER_ROW) * TILE_HEIGHT;

					// const tileTexture = new Texture({
					// 	source: tileset,
					// 	frame: new Rectangle(sx, sy, TILE_WIDTH, TILE_HEIGHT)
					// });
					const tileTexture = new Texture({
						source: tileset,
						frame: getTileFrame(texIndex, racetrack.data.tilesets[0])
					});
					const sprite = new Sprite(tileTexture);
					sprite.x = Math.floor(tileX);
					sprite.y = Math.floor(tileY);
					container.addChild(sprite);
				}
			}
		}
	}

	async function setupRacers() {
		console.log('setupRacers');

		for (const racer of racers) {
			if (!racer.pokemon || !racer.expand.pokemon) {
				continue;
			}
			const baseTexture: Texture = await Assets.load({
				src: racer.expand.pokemon.spriteSheet,
				data: { scaleMode: 'nearest', roundPixels: true }
			});
			if (!baseTexture?.source?.resource) {
				console.warn(`Failed to load sprite sheet for ${racer.expand.pokemon.name}`);
				continue;
			}
			const anim = getAnim(racer, 'Walk');
			const frameWidth = anim?.FrameWidth ?? 40;
			const frameHeight = anim?.FrameHeight ?? 40;
			const durations = anim?.Durations?.Duration ?? [8, 8, 6, 4, 4, 4];

			const frames: Texture[] = [];
			for (let row = 0; row < 8; row++) {
				for (let col = 0; col < durations.length; col++) {
					const rect = new Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight);
					const frameTexture = new Texture({ source: baseTexture.source, frame: rect });
					frameTexture.source.scaleMode = 'nearest';
					frames.push(frameTexture);
				}
			}
			racer._frames = frames;

			//set initial values
			racer._frame = Math.floor(Math.random() * (frames.length / 8)); //random starting frame
			racer._frameDurations = durations;
			racer._lastFrameTime = performance.now();
			racer._lastTargetX = racer.positioning.x;
			racer._lastTargetY = racer.positioning.y;
			racer._targetX = racer.positioning.x;
			racer._targetY = racer.positioning.y;

			const sprite = new Sprite(frames[0]);
			sprite.anchor.set(0.5);

			sprite.x = 0;
			sprite.y = 0;
			sprite.width = frameWidth;
			sprite.height = frameHeight;
			racer._pixiSprite = sprite;
			racer._interpStartTime = performance.now();
			racer._interpDuration = 100; // Or whatever value makes sense (ms)

			container.addChild(sprite);
		}
	}

	function getTileFrame(tileIndex: number, tileset: any): Rectangle {
		const cols = tileset.columns;
		const tileW = tileset.tilewidth;
		const tileH = tileset.tileheight;
		const margin = tileset.margin;
		const spacing = tileset.spacing;

		const col = tileIndex % cols;
		const row = Math.floor(tileIndex / cols);

		const x = margin + col * (tileW + spacing);
		const y = margin + row * (tileH + spacing);

		return new Rectangle(x, y, tileW, tileH);
	}

	function getAngle(racer: Racer): number {
		if (!race) return 0;

		const checkpoints = racetrack.checkpoints;
		const i = racer.currentRace.checkpointIndex;
		const a = checkpoints[i];
		const b = checkpoints[(i + 1) % Object.values(checkpoints).length];

		const dx = b.x - a.x;
		const dy = b.y - a.y;

		// Use Math.atan2, which handles direction correctly
		const angle = Math.atan2(dy, dx); // in radians

		return angle;
	}

	function getAnim(racer: Racer, name: string) {
		if (!racer.expand.pokemon) {
			return null;
		}
		const anims = racer.expand.pokemon.animData?.AnimData?.Anims?.Anim;
		return anims?.find((a: any) => a.Name === name) || anims?.[0];
	}

	function angleTo8DirectionIndex(angle: number): number {
		// Normalize to 0-360°
		const degrees = ((angle * 180) / Math.PI + 360) % 360;

		if (degrees >= 337.5 || degrees < 22.5) return 2; // right
		if (degrees >= 22.5 && degrees < 67.5) return 1; // down-right
		if (degrees >= 67.5 && degrees < 112.5) return 0; // down
		if (degrees >= 112.5 && degrees < 157.5) return 7; // down-left
		if (degrees >= 157.5 && degrees < 202.5) return 6; // left
		if (degrees >= 202.5 && degrees < 247.5) return 5; // up-left
		if (degrees >= 247.5 && degrees < 292.5) return 4; // up ✅
		if (degrees >= 292.5 && degrees < 337.5) return 3; // up-right

		return 0; // default to down
	}
</script>

<!-- {#if Object.values(checkpoints).length > 0}
	<div class="absolute right-0 bottom-0 z-[10000] float-right text-sm text-white">
		{racers[0].name}
		<br />
		{racers[0]._directionIndex}
		<br />
		{racers[0]._frame}
		<br />
		{angleTo8DirectionIndex(getAngle(racers[0]))}
		<br />
		{((getAngle(racers[0]) * 180) / Math.PI + 360) % 360}
		<br />
		{checkpoints[racers[0].checkpointIndex].x + ' ' + checkpoints[racers[0].checkpointIndex].y}
		<br />
		{checkpoints[racers[0].checkpointIndex + 1].x +
			' ' +
			checkpoints[racers[0].checkpointIndex + 1].y}
	</div>
{/if} -->

<!-- <div class="absolute right-6 bottom-6 z-[10000] float-right text-sm text-white">
	{fps}
	<br />
	{touch.pinchStart}
	<br />
	{touch.distance}
	<br />
	{camera.mode + ' ' + camera.targetRacerId}
</div> -->

{#if isPreview}
	<img src="preview.png" alt="Preview" />
{:else}
	<canvas class="" id="pixi-canvas" bind:this={canvasEl}></canvas>
{/if}
