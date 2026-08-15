const DEFAULT_RACE_FORMAT = 'circuit';

function normalizeRaceFormat(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_RACE_FORMAT;
}

function trackFormats(track) {
	return Array.isArray(track.compatibleFormats) && track.compatibleFormats.length > 0
		? track.compatibleFormats
		: [DEFAULT_RACE_FORMAT];
}

function selectCompatibleTrack(tracks, format, selectionIndex) {
	const normalizedFormat = normalizeRaceFormat(format);
	const compatible = tracks
		.filter((track) => trackFormats(track).includes(normalizedFormat))
		.sort((left, right) => left.id.localeCompare(right.id));
	if (compatible.length === 0) {
		throw new Error(`No racetrack supports the “${normalizedFormat}” race format.`);
	}
	const index = ((selectionIndex % compatible.length) + compatible.length) % compatible.length;
	return compatible[index];
}

module.exports = { DEFAULT_RACE_FORMAT, normalizeRaceFormat, selectCompatibleTrack };
