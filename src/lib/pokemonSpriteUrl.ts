import type { Pokemon } from '$lib/types';

export function getWalkSpriteUrl(pokemon: Pokemon) {
	return pokemon.overworldImage
		? undefined
		: `/pokemon-sprites/${spriteSpecies(pokemon, 'walkAnimation')}-walk.png`;
}

export function getLeaderboardSpriteUrl(pokemon: Pokemon) {
	if (pokemon.id && !pokemon.id.startsWith('prlseedpoke') && pokemon.leaderboardImage) {
		return `/api/files/pokemon/${pokemon.id}/${pokemon.leaderboardImage}`;
	}

	return `/pokemon-sprites/${spriteSpecies(pokemon, 'portrait')}-portrait.png`;
}

function spriteSpecies(pokemon: Pokemon, asset: 'portrait' | 'walkAnimation'): string {
	if (pokemon.assetState?.[asset] === 'fallback') {
		return pokemon.assetState.fallbackSpecies ?? 'pikachu';
	}
	return pokemon.name.toLowerCase();
}
