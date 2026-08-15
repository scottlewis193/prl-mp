import assert from 'node:assert/strict';
import test from 'node:test';

import { getLeaderboardSpriteUrl, getWalkSpriteUrl } from '../src/lib/pokemonSpriteUrl';
import type { Pokemon } from '../src/lib/types';

test('uses the bundled walk sprite when no PocketBase sprite is uploaded', () => {
	const pokemon = { name: 'Pikachu', overworldImage: '' } as Pokemon;

	assert.equal(getWalkSpriteUrl(pokemon), '/pokemon-sprites/pikachu-walk.png');
});

test('uses the bundled portrait when no PocketBase portrait is uploaded', () => {
	const pokemon = { name: 'Pikachu', leaderboardImage: '', mugshot: '' } as Pokemon;

	assert.equal(getLeaderboardSpriteUrl(pokemon), '/pokemon-sprites/pikachu-portrait.png');
});

test('uses the bundled portrait for seeded Pokémon with stale PocketBase filenames', () => {
	const pokemon = {
		id: 'prlseedpoke0001',
		name: 'Pikachu',
		leaderboardImage: 'pikachu_portrait_missing.png',
		mugshot: ''
	} as Pokemon;

	assert.equal(getLeaderboardSpriteUrl(pokemon), '/pokemon-sprites/pikachu-portrait.png');
});

test('uses the declared generic fallback when a catalogued species has no bespoke assets', () => {
	const pokemon = {
		name: 'Genesect',
		overworldImage: '',
		leaderboardImage: '',
		assetState: {
			portrait: 'fallback',
			walkAnimation: 'fallback',
			fallbackSpecies: 'pikachu'
		}
	} as Pokemon;

	assert.equal(getWalkSpriteUrl(pokemon), '/pokemon-sprites/pikachu-walk.png');
	assert.equal(getLeaderboardSpriteUrl(pokemon), '/pokemon-sprites/pikachu-portrait.png');
});
