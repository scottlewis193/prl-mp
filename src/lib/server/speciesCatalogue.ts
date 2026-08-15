import type { SpeciesAssetState, SpeciesProvenance } from '../species';

export type { SpeciesAssetState, SpeciesProvenance } from '../species';

export type SpeciesBaseStats = {
	hp: number;
	attack: number;
	defense: number;
	specialAttack: number;
	specialDefense: number;
	speed: number;
	total: number;
};

export type SpeciesCatalogueEntry = {
	pokedexNumber: number;
	name: string;
	generation: number;
	types: string[];
	baseStats: SpeciesBaseStats;
	provenance: SpeciesProvenance;
	assets: SpeciesAssetState;
};

export type StoredSpecies = SpeciesCatalogueEntry & { id: string };

export interface SpeciesCatalogueRepository {
	list(): Promise<StoredSpecies[]>;
	create(species: SpeciesCatalogueEntry): Promise<void>;
	update(id: string, species: SpeciesCatalogueEntry): Promise<void>;
}

export function validateSpeciesCatalogue(catalogue: SpeciesCatalogueEntry[]): void {
	const counts = new Map<number, number>();
	for (const entry of catalogue)
		counts.set(entry.pokedexNumber, (counts.get(entry.pokedexNumber) ?? 0) + 1);
	const duplicates = [...counts].filter(([, count]) => count > 1).map(([number]) => number);
	const missing = Array.from({ length: 649 }, (_, index) => index + 1).filter(
		(number) => !counts.has(number)
	);
	const outOfRange = [...counts.keys()].filter(
		(number) => !Number.isInteger(number) || number < 1 || number > 649
	);
	if (duplicates.length || missing.length || outOfRange.length || catalogue.length !== 649) {
		const problems = [];
		if (duplicates.length)
			problems.push(`Duplicate National Pokédex entries: ${duplicates.join(', ')}`);
		if (missing.length) problems.push(`missing entries: ${missing.join(', ')}`);
		if (outOfRange.length) problems.push(`out-of-range entries: ${outOfRange.join(', ')}`);
		throw new Error(`Invalid species catalogue — ${problems.join('; ')}`);
	}

	for (const entry of catalogue) {
		const statValues = [
			entry.baseStats.hp,
			entry.baseStats.attack,
			entry.baseStats.defense,
			entry.baseStats.specialAttack,
			entry.baseStats.specialDefense,
			entry.baseStats.speed
		];
		if (
			!entry.name ||
			!Number.isInteger(entry.generation) ||
			entry.generation < 1 ||
			entry.generation > 5 ||
			entry.types.length < 1 ||
			statValues.some((stat) => !Number.isInteger(stat) || stat < 1) ||
			entry.baseStats.total !== statValues.reduce((sum, stat) => sum + stat, 0) ||
			!entry.provenance.source ||
			!entry.provenance.version ||
			!entry.provenance.url ||
			!entry.assets.portrait ||
			!entry.assets.walkAnimation
		) {
			throw new Error(
				`Invalid species catalogue entry at National Pokédex #${entry.pokedexNumber}`
			);
		}
	}
}

export async function importSpeciesCatalogue(
	catalogue: SpeciesCatalogueEntry[],
	repository: SpeciesCatalogueRepository
): Promise<{ created: number; updated: number; total: number }> {
	validateSpeciesCatalogue(catalogue);
	const existing = await repository.list();
	const byNumber = new Map<number, StoredSpecies>();
	for (const record of existing) {
		if (byNumber.has(record.pokedexNumber)) {
			throw new Error(
				`Existing pokemon catalogue has duplicate National Pokédex entry: ${record.pokedexNumber}`
			);
		}
		byNumber.set(record.pokedexNumber, record);
	}

	let created = 0;
	let updated = 0;
	for (const entry of catalogue) {
		const record = byNumber.get(entry.pokedexNumber);
		if (record) {
			await repository.update(record.id, entry);
			updated++;
		} else {
			await repository.create(entry);
			created++;
		}
	}
	const imported = await repository.list();
	const importedNumbers = imported.map(({ pokedexNumber }) => pokedexNumber);
	if (imported.length !== 649 || new Set(importedNumbers).size !== 649) {
		throw new Error(
			`Imported pokemon catalogue verification failed: expected 649 unique entries, found ${imported.length} records and ${new Set(importedNumbers).size} unique National Pokédex numbers`
		);
	}
	return { created, updated, total: imported.length };
}

export async function listSpecies(
	repository: SpeciesCatalogueRepository
): Promise<StoredSpecies[]> {
	return (await repository.list()).sort((left, right) => left.pokedexNumber - right.pokedexNumber);
}

export async function resolveSpecies(
	repository: SpeciesCatalogueRepository,
	identity: number | string
): Promise<StoredSpecies | undefined> {
	const species = await listSpecies(repository);
	if (typeof identity === 'number')
		return species.find(({ pokedexNumber }) => pokedexNumber === identity);
	const normalized = identity.trim().toLocaleLowerCase();
	return species.find(({ name }) => name.toLocaleLowerCase() === normalized);
}
