const DEFAULT_RACE_FORMAT = 'circuit';

function normalizeRaceFormat(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_RACE_FORMAT;
}

function trackFormats(track) {
	return Array.isArray(track.compatibleFormats) && track.compatibleFormats.length > 0
		? track.compatibleFormats
		: [DEFAULT_RACE_FORMAT];
}

function seedOffset(seed, trackCount) {
	if (!seed || trackCount < 2) return 0;
	let checksum = 0;
	for (const character of String(seed)) checksum = (checksum + character.codePointAt(0)) >>> 0;
	return checksum % trackCount;
}

function selectCompatibleTrack(tracks, format, selectionIndex, schedulingSeed) {
	const normalizedFormat = normalizeRaceFormat(format);
	const compatible = tracks
		.filter((track) => trackFormats(track).includes(normalizedFormat))
		.sort((left, right) => left.id.localeCompare(right.id));
	if (compatible.length === 0) {
		throw new Error(`No racetrack supports the “${normalizedFormat}” race format.`);
	}
	const seededIndex = selectionIndex + seedOffset(schedulingSeed, compatible.length);
	const index = ((seededIndex % compatible.length) + compatible.length) % compatible.length;
	return compatible[index];
}

module.exports = { DEFAULT_RACE_FORMAT, normalizeRaceFormat, selectCompatibleTrack };
