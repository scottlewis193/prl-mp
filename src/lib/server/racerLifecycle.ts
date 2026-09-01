import type { RacerLifecycle, RacerTraits } from '$lib/types';

export const RACER_TRAIT_RULES_VERSION = 'racer-traits-v1';

type RacerTraitGenerationInput = {
	speciesKey: string;
	generationSeed: string;
	rulesVersion: string;
};

function hashSeed(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function createRandom(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

export function generateRacerTraits(input: RacerTraitGenerationInput): RacerTraits {
	if (input.rulesVersion !== RACER_TRAIT_RULES_VERSION) {
		throw new Error(`Unsupported racer trait rules version: ${input.rulesVersion}`);
	}
	const random = createRandom(
		hashSeed(`${input.rulesVersion}:${input.speciesKey}:${input.generationSeed}`)
	);
	const trait = () => Math.floor(random() * 100) + 1;
	return {
		durability: trait(),
		resilience: trait(),
		temperament: trait(),
		consistency: trait(),
		potential: trait(),
		longevity: trait()
	};
}

export function createRacerLifecycle(input: {
	speciesKey: string;
	generationSeed: string;
	careerStartedAt: string;
}): RacerLifecycle {
	return {
		traits: generateRacerTraits({
			speciesKey: input.speciesKey,
			generationSeed: input.generationSeed,
			rulesVersion: RACER_TRAIT_RULES_VERSION
		}),
		generationSeed: input.generationSeed,
		traitRulesVersion: RACER_TRAIT_RULES_VERSION,
		careerStartedAt: input.careerStartedAt,
		careerLoad: 0,
		health: { eligible: true, performanceMultiplier: 1, activeConditionIds: [] }
	};
}
