import assetMetadata from '../../data/pokemon-assets.v1.json';

export type SpeciesProvenance = {
	source: string;
	version: string;
	url: string;
};

export type SpeciesAssetState = {
	portrait: 'bundled' | 'fallback';
	walkAnimation: 'bundled' | 'fallback';
	fallbackSpecies: string | null;
};

export const FALLBACK_WALK_ANIMATION = assetMetadata.fallbackWalkAnimation;
