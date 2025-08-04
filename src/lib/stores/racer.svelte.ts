import PocketBase from 'pocketbase';
import pb from '../pocketbase';

import { getContext, setContext } from 'svelte';

import type { Pokemon, Racer } from '$lib/types';

const racersKey = Symbol('racers');
const currentRacersKey = Symbol('currentRacers');
let _racers: Racer[] = $state([]);
export function setRacersContext(racers: Racer[]) {
	_racers = racers;
	return setContext<Racer[]>(racersKey, _racers);
}

export function getRacersContext(): Racer[] {
	return getContext<Racer[]>(racersKey);
}

export function setCurrentRacersContext(racers: Racer[] | undefined = undefined) {
	const _currentRacers: Racer[] | undefined = $state(racers);
	return setContext<Racer[] | undefined>(currentRacersKey, _currentRacers);
}

export function getCurrentRacersContext(): Racer[] {
	return getContext<Racer[]>(currentRacersKey);
}

export async function subscribeToRacers(racersAry: Racer[], pb: PocketBase) {
	await pb.collection('racers').unsubscribe();
	await pb.collection('racers').subscribe(
		'*',
		async function (e) {
			const racerRecord = e.record as unknown as Racer;

			switch (e.action) {
				case 'create':
					racersAry.push(racerRecord);
					break;
				case 'update':
					updateRacerOnScreen(racerRecord);

					break;
				case 'delete':
					racersAry.splice(
						racersAry.findIndex((r) => r.id === racerRecord.id),
						1
					);
					break;
			}
		},
		{ expand: 'pokemon' }
	);
}

function updateRacerOnScreen(updated: Racer) {
	const i = _racers.findIndex((r) => r.id === updated.id);

	if (i === -1) {
		_racers.push(updated);
	} else {
		if (_racers[i] === _racers[0]) {
			// console.log(_racers[i], updated);
		}

		Object.assign(_racers[i], updated);

		const now = performance.now();

		//interpolation
		_racers[i]._lastTargetX = _racers[i]._targetX;
		_racers[i]._lastTargetY = _racers[i]._targetY;
		_racers[i]._targetX = updated.positioning.x;
		_racers[i]._targetY = updated.positioning.y;
		_racers[i]._interpStartTime = now;
		_racers[i]._interpDuration = 500; // milliseconds
	}
}

export async function unsubscribeFromRacers(pb: PocketBase) {
	if (!pb) return;
	await pb.collection('racers').unsubscribe();
}

export function getSymbol(racer: Racer) {
	const pokemon = racer.expand.pokemon as Pokemon;
	const symbolChar1 = racer.name.charAt(0).toUpperCase();
	const symbolChar2 = racer.name
		.charAt(
			Math.ceil(
				(racer.name.length - (racer.name.charAt((racer.name.length - 1) / 2) == '-' ? 0 : 1)) / 2
			)
		)
		.toUpperCase();
	const symbolChar3 = pokemon.name.charAt(0).toUpperCase();
	const symbolChar4 = pokemon.name.charAt((pokemon.name.length - 1) / 2).toUpperCase();
	const symbol = symbolChar1 + symbolChar2 + symbolChar3 + symbolChar4;

	return symbol;
}

export async function getPBImageDataUrl(record: any, ImgSrcUrl: string) {
	const token = pb.files.getToken();
	const picUrl = pb.files.getURL(record, ImgSrcUrl, { token });
	const response = await fetch(picUrl);
	const blob = await response.blob();

	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
