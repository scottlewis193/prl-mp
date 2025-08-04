import type { Trainer } from '$lib/types';
import { getContext, setContext } from 'svelte';

const trainersKey = Symbol('trainers');

export function getTrainersContext(trainers: Trainer[]) {
	return getContext(trainersKey);
}

export function setTrainersContext(trainers: Trainer[]) {
	const _trainers = $state(trainers);
	return setContext(trainersKey, _trainers);
}
