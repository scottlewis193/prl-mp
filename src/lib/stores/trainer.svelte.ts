import { getContext, setContext } from 'svelte';

type TrainerType = {
	id: string;
	name: string;
	motivation: number;
	tactics: number;
	bond: number;
	gender: 'male' | 'female';
};

export class Trainer implements TrainerType {
	id: string = $state('');
	name: string = $state('');
	motivation: number = $state(1);
	tactics: number = $state(1);
	bond: number = $state(1);
	gender: 'male' | 'female' = $state('male');
}

const trainersKey = Symbol('trainers');

export function getTrainersContext(trainers: Trainer[]) {
	return getContext(trainersKey);
}

export function setTrainersContext(trainers: Trainer[]) {
	const _trainers = $state(trainers);
	return setContext(trainersKey, _trainers);
}
