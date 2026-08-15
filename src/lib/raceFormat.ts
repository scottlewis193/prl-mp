export const RACE_FORMATS = ['circuit'] as const;
export type RaceFormat = (typeof RACE_FORMATS)[number];
export const DEFAULT_RACE_FORMAT: RaceFormat = RACE_FORMATS[0];

export function normalizeRaceFormat(value: unknown): RaceFormat {
	const candidate = typeof value === 'string' ? value.trim() : '';
	return RACE_FORMATS.find((format) => format === candidate) ?? DEFAULT_RACE_FORMAT;
}

export function normalizeCompatibleFormats(value: unknown): RaceFormat[] {
	if (!Array.isArray(value)) return [DEFAULT_RACE_FORMAT];
	const formats = RACE_FORMATS.filter((format) => value.includes(format));
	return formats.length > 0 ? formats : [DEFAULT_RACE_FORMAT];
}
