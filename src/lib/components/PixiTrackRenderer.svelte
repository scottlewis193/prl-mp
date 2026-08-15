<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Application,
		Assets,
		Container,
		Matrix,
		Rectangle,
		Sprite,
		Texture,
		type Ticker
	} from 'pixi.js';

	import { getCameraContext } from '$lib/stores/camera.svelte';
	import { getCurrentRaceContext } from '$lib/stores/race.svelte';
	import { getCurrentRacersContext, getPBImageDataUrl } from '$lib/stores/racer.svelte';
	import { getCurrentRacetrackContext } from '$lib/stores/racetrack.svelte';
	import { getWalkSpriteUrl } from '$lib/pokemonSpriteUrl';
	import { initializeTrackGraphics } from '$lib/trackGraphics';
	import pb from '$lib/pocketbase';
	import {
		createTrackRenderPlan,
		resolveTrackTilesetUrl,
		type TilesetUrlResolver,
		type TrackRenderPlan
	} from '$lib/trackRendering';
	import { createViewerLifecycleManager } from '$lib/viewerLifecycle';
	import type { Racer } from '$lib/types';

	type ViewerLifecycle = ReturnType<typeof createViewerLifecycleManager>['current'];
	type ViewerResources = {
		appDestroyed: boolean;
		trackContainer?: Container;
		trackIsCached: boolean;
		racerSprites: Map<Racer, Sprite>;
	};

	const race = getCurrentRaceContext();
	const racetrack = getCurrentRacetrackContext();
	const racers = getCurrentRacersContext();
	const camera = getCameraContext();

	let canvasEl: HTMLCanvasElement;
	let app: Application | undefined;
	let world: Container | undefined;
	let trackContainer: Container | undefined;
	let checkpoints: TrackRenderPlan['checkpoints'] = [];
	const lifecycleManager = createViewerLifecycleManager();
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let errorMessage = $state('');
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	const touch = { pinchStart: 0, isScaling: false, distance: 0 };

	onMount(() => {
		void initializeViewer();
		return () => void disposeViewer();
	});

	async function initializeViewer() {
		status = 'loading';
		errorMessage = '';
		const currentLifecycle = await lifecycleManager.replace();
		if (currentLifecycle.disposed) return;
		const resources: ViewerResources = {
			appDestroyed: false,
			trackIsCached: false,
			racerSprites: new Map()
		};
		const currentApp = new Application();
		currentLifecycle.renderer(() => destroyApplication(currentApp, resources));

		try {
			app = currentApp;
			await currentApp.init({
				canvas: canvasEl,
				resizeTo: canvasEl.parentElement ?? window,
				background: 0x000000,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true,
				antialias: false,
				autoStart: false
			});

			if (currentLifecycle.disposed) {
				destroyApplication(currentApp, resources);
				return;
			}

			world = new Container({ label: 'race-world' });
			trackContainer = new Container({ label: 'static-track', isRenderGroup: true });
			resources.trackContainer = trackContainer;
			const racerContainer = new Container({ label: 'racers' });
			world.addChild(trackContainer, racerContainer);
			currentApp.stage.addChild(world);
			updateCamera();

			const setupStartedAt = performance.now();
			const plan = createTrackRenderPlan(racetrack, resolveTilesetUrl);
			checkpoints = plan.checkpoints;
			await setupTrack(plan, trackContainer, currentLifecycle);
			if (currentLifecycle.disposed) return;
			await setupRacers(racerContainer, currentLifecycle, resources);
			if (currentLifecycle.disposed) return;

			const canCacheTrack =
				plan.tileCount >= 128 && plan.size.width <= 4096 && plan.size.height <= 4096;
			if (canCacheTrack) {
				trackContainer.cacheAsTexture(true);
				resources.trackIsCached = true;
			}
			console.debug('Race track render profile', {
				track: racetrack.name,
				tiles: plan.tileCount,
				layers: plan.layers.length,
				setupMs: Math.round((performance.now() - setupStartedAt) * 10) / 10,
				strategy: canCacheTrack ? 'cached static container' : 'sprite batching'
			});

			addListeners(currentLifecycle);
			const frameProfileStartedAt = performance.now();
			let profiledFrames = 0;
			const tickViewer = (ticker: Ticker) => {
				updateRacers(ticker);
				profiledFrames++;
				if (profiledFrames === 60) {
					console.debug('Race viewer frame profile', {
						track: racetrack.name,
						fps: Math.round(ticker.FPS),
						averageFrameMs:
							Math.round(((performance.now() - frameProfileStartedAt) / profiledFrames) * 10) / 10,
						strategy: canCacheTrack ? 'cached static container' : 'sprite batching'
					});
				}
			};
			currentLifecycle.tick(currentApp.ticker, tickViewer);
			currentApp.start();
			status = 'ready';
		} catch (error) {
			if (currentLifecycle.disposed) {
				destroyApplication(currentApp, resources);
				return;
			}
			console.error('Unable to start race viewer', error);
			errorMessage = error instanceof Error ? error.message : 'An unknown loading error occurred.';
			status = 'error';
			await currentLifecycle.dispose();
		}
	}

	async function disposeViewer() {
		await lifecycleManager.dispose();
		app = undefined;
		world = undefined;
		trackContainer = undefined;
		checkpoints = [];
		isDragging = false;
		touch.isScaling = false;
	}

	function destroyApplication(currentApp: Application, resources: ViewerResources) {
		if (resources.appDestroyed || !currentApp.renderer) return;
		resources.appDestroyed = true;
		if (
			resources.trackIsCached &&
			resources.trackContainer &&
			!resources.trackContainer.destroyed
		) {
			resources.trackContainer.cacheAsTexture(false);
		}
		for (const [racer, sprite] of resources.racerSprites) {
			if (racer._pixiSprite === sprite) {
				racer._pixiSprite = undefined;
				racer._frames = [];
				racer._frameElapsed = undefined;
			}
		}
		currentApp.stop();
		currentApp.destroy(
			{ removeView: false },
			{ children: true, texture: true, textureSource: false }
		);
	}

	const resolveTilesetUrl: TilesetUrlResolver = (track, tileset, index) => {
		return resolveTrackTilesetUrl(track, tileset, index, (record, filename) =>
			pb.files.getURL(record, filename)
		);
	};

	async function setupTrack(
		plan: TrackRenderPlan,
		destination: Container,
		currentLifecycle: ViewerLifecycle
	) {
		const textures = await Promise.all(
			plan.tilesets.map(async (tileset) => {
				try {
					const texture = (await Assets.load({
						src: tileset.url,
						data: { scaleMode: 'nearest' }
					})) as Texture;
					currentLifecycle.asset(tileset.url, (source) => Assets.unload(source));
					return texture;
				} catch (error) {
					throw new Error(`Could not load tileset “${tileset.url}”.`, { cause: error });
				}
			})
		);
		if (currentLifecycle.disposed) return;

		for (const layerPlan of plan.layers) {
			const layer = new Container({ label: layerPlan.name, alpha: layerPlan.opacity });
			for (const tile of layerPlan.tiles) {
				const texture = new Texture({
					source: textures[tile.tilesetIndex].source,
					frame: new Rectangle(tile.frame.x, tile.frame.y, tile.frame.width, tile.frame.height)
				});
				const sprite = new Sprite({ texture, x: tile.x, y: tile.y, roundPixels: true });
				if (tile.transform) {
					sprite.anchor.set(0.5);
					sprite.setFromMatrix(
						new Matrix(
							tile.transform.a,
							tile.transform.b,
							tile.transform.c,
							tile.transform.d,
							tile.x + tile.frame.width / 2,
							tile.y + tile.frame.height / 2
						)
					);
				}
				layer.addChild(sprite);
			}
			destination.addChild(layer);
		}

		initializeTrackGraphics(destination, plan.geometry);
	}

	async function setupRacers(
		destination: Container,
		currentLifecycle: ViewerLifecycle,
		resources: ViewerResources
	) {
		for (const racer of racers) {
			if (!racer.pokemon || !racer.expand.pokemon) continue;

			const pokemon = racer.expand.pokemon;
			const bundledSprite = getWalkSpriteUrl(pokemon);
			const spriteSheet =
				bundledSprite ?? (await getPBImageDataUrl(pokemon, pokemon.overworldImage));
			pokemon.spriteSheet = spriteSheet;

			let baseTexture: Texture;
			try {
				baseTexture = (await Assets.load({
					src: spriteSheet,
					data: { scaleMode: 'nearest' }
				})) as Texture;
				currentLifecycle.asset(spriteSheet, (source) => Assets.unload(source));
			} catch (error) {
				throw new Error(`Could not load ${pokemon.name}’s sprite sheet.`, { cause: error });
			}
			if (currentLifecycle.disposed) return;

			const animation = getAnimation(racer, 'Walk');
			const frameWidth = animation?.FrameWidth ?? 40;
			const frameHeight = animation?.FrameHeight ?? 40;
			const durations: number[] = animation?.Durations?.Duration ?? [8, 8, 6, 4, 4, 4];
			const frames: Texture[] = [];
			for (let row = 0; row < 8; row++) {
				for (let column = 0; column < durations.length; column++) {
					frames.push(
						new Texture({
							source: baseTexture.source,
							frame: new Rectangle(column * frameWidth, row * frameHeight, frameWidth, frameHeight)
						})
					);
				}
			}

			racer._frames = frames;
			racer._frame = Math.floor(Math.random() * durations.length);
			racer._frameDurations = durations;
			racer._lastTargetX = racer.positioning.x;
			racer._lastTargetY = racer.positioning.y;
			racer._targetX = racer.positioning.x;
			racer._targetY = racer.positioning.y;
			racer._interpStartTime = performance.now();
			racer._interpDuration = 100;

			const sprite = new Sprite({ texture: frames[0], anchor: 0.5 });
			sprite.setSize(frameWidth, frameHeight);
			racer._pixiSprite = sprite;
			resources.racerSprites.set(racer, sprite);
			destination.addChild(sprite);
		}
	}

	function addListeners(currentLifecycle: ViewerLifecycle) {
		currentLifecycle.listen(canvasEl, 'mousedown', onMouseDown);
		currentLifecycle.listen(canvasEl, 'touchstart', onTouchStart);
		currentLifecycle.listen(window, 'mousemove', onMouseMove);
		currentLifecycle.listen(window, 'touchmove', onTouchMove);
		currentLifecycle.listen(window, 'touchcancel', stopTouch);
		currentLifecycle.listen(window, 'mouseup', stopDragging);
		currentLifecycle.listen(window, 'touchend', stopTouch);
		currentLifecycle.listen(canvasEl, 'wheel', onWheel, { passive: false });
	}

	function onMouseDown(event: Event) {
		if (camera.mode !== 'free') return;
		const mouseEvent = event as MouseEvent;
		isDragging = true;
		dragStart = { x: mouseEvent.clientX, y: mouseEvent.clientY };
	}

	function onTouchStart(event: Event) {
		if (camera.mode !== 'free') return;
		const touchEvent = event as TouchEvent;
		if (touchEvent.touches.length === 2) {
			touch.pinchStart = touchDistance(touchEvent);
			touch.isScaling = true;
		} else if (touchEvent.touches[0]) {
			isDragging = true;
			dragStart = { x: touchEvent.touches[0].clientX, y: touchEvent.touches[0].clientY };
		}
	}

	function onMouseMove(event: Event) {
		if (!isDragging) return;
		const mouseEvent = event as MouseEvent;
		panCamera(mouseEvent.clientX, mouseEvent.clientY);
	}

	function onTouchMove(event: Event) {
		const touchEvent = event as TouchEvent;
		if (touch.isScaling && touchEvent.touches.length === 2) {
			touch.distance = touchDistance(touchEvent);
			camera.zoom = Math.max(
				0.2,
				Math.min(4, camera.zoom + (touch.distance - touch.pinchStart) / 10000)
			);
			touch.pinchStart = touch.distance;
			updateCamera();
		} else if (isDragging && touchEvent.touches[0]) {
			panCamera(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
		}
	}

	function onWheel(event: Event) {
		const wheelEvent = event as WheelEvent;
		wheelEvent.preventDefault();
		camera.zoom = Math.max(0.2, Math.min(4, camera.zoom - wheelEvent.deltaY * 0.001));
		updateCamera();
	}

	function stopDragging() {
		isDragging = false;
	}

	function stopTouch() {
		touch.isScaling = false;
		isDragging = false;
	}

	function touchDistance(event: TouchEvent) {
		return Math.hypot(
			event.touches[0].pageX - event.touches[1].pageX,
			event.touches[0].pageY - event.touches[1].pageY
		);
	}

	function panCamera(x: number, y: number) {
		camera.x += x - dragStart.x;
		camera.y += y - dragStart.y;
		dragStart = { x, y };
		updateCamera();
	}

	function updateCamera() {
		if (!world) return;
		world.scale.set(camera.zoom);
		world.position.set(camera.x, camera.y);
	}

	function updateRacers(ticker: Ticker) {
		for (const racer of racers) {
			if (!racer._frames?.length || !racer._pixiSprite) continue;
			const durations = racer._frameDurations?.length ? racer._frameDurations : [8, 8, 6, 4, 4, 4];
			racer._frameElapsed = (racer._frameElapsed ?? 0) + ticker.deltaMS;
			const currentDuration = durations[racer._frame] * (1000 / 60);
			if (racer._frameElapsed >= currentDuration) {
				racer._frameElapsed %= currentDuration;
				racer._frame = (racer._frame + 1) % durations.length;
			}

			const frameIndex = angleTo8DirectionIndex(getAngle(racer)) * durations.length + racer._frame;
			if (racer._frames[frameIndex]) racer._pixiSprite.texture = racer._frames[frameIndex];

			const interpolation = clamp(
				(performance.now() - racer._interpStartTime) / (racer._interpDuration || 500),
				0,
				1
			);
			racer._displayX = lerp(racer._lastTargetX, racer._targetX, interpolation);
			racer._displayY = lerp(racer._lastTargetY, racer._targetY, interpolation);
			racer._pixiSprite.position.set(racer._displayX, racer._displayY);

			if (camera.mode === 'follow' && camera.targetRacerId === racer.id && app) {
				camera.x = app.screen.width / 2 - racer._displayX;
				camera.y = app.screen.height / 2 - racer._displayY;
				updateCamera();
			}
		}
	}

	const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;
	const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

	function getAngle(racer: Racer): number {
		if (!race || checkpoints.length < 2) return 0;
		const index = racer.currentRace.checkpointIndex % checkpoints.length;
		const current = checkpoints[index];
		const next = checkpoints[(index + 1) % checkpoints.length];
		return Math.atan2(next.y - current.y, next.x - current.x);
	}

	function getAnimation(racer: Racer, name: string) {
		const animations = racer.expand.pokemon?.animData?.AnimData?.Anims?.Anim;
		return (
			animations?.find((animation: { Name?: string }) => animation.Name === name) ?? animations?.[0]
		);
	}

	function angleTo8DirectionIndex(angle: number): number {
		const degrees = ((angle * 180) / Math.PI + 360) % 360;
		if (degrees >= 337.5 || degrees < 22.5) return 2;
		if (degrees < 67.5) return 1;
		if (degrees < 112.5) return 0;
		if (degrees < 157.5) return 7;
		if (degrees < 202.5) return 6;
		if (degrees < 247.5) return 5;
		if (degrees < 292.5) return 4;
		return 3;
	}
</script>

<canvas
	id="pixi-canvas"
	class:invisible={status !== 'ready'}
	aria-label={`Race track for ${racetrack.name}`}
	bind:this={canvasEl}
></canvas>

{#if status === 'loading'}
	<div
		class="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-white"
		role="status"
	>
		Loading {racetrack.name}…
	</div>
{:else if status === 'error'}
	<div
		class="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-6 text-white"
		role="alert"
	>
		<div class="max-w-md text-center">
			<h2 class="text-xl font-bold">Race viewer could not load</h2>
			<p class="mt-2">{errorMessage}</p>
			<div class="mt-4 flex justify-center gap-3">
				<button class="btn btn-primary" onclick={() => void initializeViewer()}>Retry</button>
				<a class="btn" href="/races">Exit race</a>
			</div>
		</div>
	</div>
{/if}
