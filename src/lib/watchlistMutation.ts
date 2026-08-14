type WatchlistMutationOptions = {
	current: string[];
	racerId: string;
	apply: (watchlist: string[]) => void;
	persist: (watchlist: string[]) => Promise<string[]>;
};

export async function mutateWatchlist({
	current,
	racerId,
	apply,
	persist
}: WatchlistMutationOptions): Promise<string[]> {
	const previous = [...current];
	const optimistic = previous.includes(racerId)
		? previous.filter((id) => id !== racerId)
		: [...previous, racerId];

	apply(optimistic);
	try {
		const saved = await persist(optimistic);
		apply(saved);
		return saved;
	} catch (error) {
		apply(previous);
		throw error;
	}
}
