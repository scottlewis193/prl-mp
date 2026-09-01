declare const trackSelection: {
	DEFAULT_RACE_FORMAT: string;
	normalizeRaceFormat(value: unknown): string;
	selectCompatibleTrack<T extends { id: string; compatibleFormats?: string[] }>(
		tracks: T[],
		format: string,
		selectionIndex: number,
		schedulingSeed?: string
	): T;
};

export = trackSelection;
