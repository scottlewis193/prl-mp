import { female, male } from './static/names';

export function selectRacerName(gender: 'male' | 'female', random = Math.random) {
	const names = gender === 'female' ? female : male;
	return names[Math.floor(random() * names.length)];
}

export function selectRacerGender(random = Math.random): 'male' | 'female' {
	return random() < 0.5 ? 'male' : 'female';
}
