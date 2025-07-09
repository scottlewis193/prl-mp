import { getContext, setContext } from 'svelte';
import type { Racer } from './racer.svelte';

export interface Camera {
	mode: 'free' | 'follow';
	targetRacerId: string | null;
	x: number;
	y: number;
	zoom: number;
	isPanning: boolean;
	lastMouse: { x: number; y: number };
}

const defaultCamera: Camera = {
	mode: 'free',
	targetRacerId: null,
	x: 0,
	y: 0,
	zoom: 1,
	isPanning: false,
	lastMouse: { x: 0, y: 0 }
};

const cameraKey = Symbol('camera');

export function getCameraContext(): Camera {
	return getContext<Camera>(cameraKey);
}

export function setCameraContext() {
	const camera = $state(defaultCamera);
	return setContext<Camera>(cameraKey, camera);
}

export function getCameraTransform({
	pos,
	camera,
	zoom
}: {
	pos: { x: number; y: number };
	camera: { x: number; y: number };
	zoom: number;
}) {
	return {
		x: (pos.x - camera.x) * zoom + window.innerWidth / 2,
		y: (pos.y - camera.y) * zoom + window.innerHeight / 2
	};
}
