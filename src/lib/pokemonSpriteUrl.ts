import type { Pokemon } from '$lib/types';

export function getWalkSpriteUrl(pokemon: Pokemon) {
	return pokemon.overworldImage
		? undefined
		: `/pokemon-sprites/${pokemon.name.toLowerCase()}-walk.png`;
}

export function getLeaderboardSpriteUrl(pokemon: Pokemon) {
	if (
		pokemon.id &&
		!pokemon.id.startsWith('prlseedpoke') &&
		pokemon.leaderboardImage
	) {
		return `/api/files/pokemon/${pokemon.id}/${pokemon.leaderboardImage}`;
	}

	return `/pokemon-sprites/${pokemon.name.toLowerCase()}-portrait.png`;
}
