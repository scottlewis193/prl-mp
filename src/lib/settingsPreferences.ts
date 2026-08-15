export const cameraModeOptions = [
	{ value: 'free', label: 'Free camera' },
	{ value: 'follow', label: 'Follow the leading racer' }
] as const;

export const leaderboardModeOptions = [
	{ value: 'interval', label: 'Time intervals' },
	{ value: 'leader', label: 'Distance from leader' }
] as const;

export const themeOptions = [
	{ value: 'system', label: 'Use system setting' },
	{ value: 'acid', label: 'Acid' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'cupcake', label: 'Cupcake' }
] as const;

export type CameraMode = (typeof cameraModeOptions)[number]['value'];
export type LeaderboardMode = (typeof leaderboardModeOptions)[number]['value'];
export type Theme = (typeof themeOptions)[number]['value'];

export type SettingsPreferences = {
	cameraMode: CameraMode;
	leaderboardMode: LeaderboardMode;
	theme: Theme;
	reducedMotion: boolean;
	highContrast: boolean;
};

function includes<T extends string>(
	options: ReadonlyArray<{ value: T }>,
	value: string
): value is T {
	return options.some((option) => option.value === value);
}

export function parseSettingsPreferences(
	formData: FormData
): { ok: true; preferences: SettingsPreferences } | { ok: false; error: string } {
	const cameraMode = formData.get('cameraMode')?.toString() ?? '';
	const leaderboardMode = formData.get('leaderboardMode')?.toString() ?? '';
	const theme = formData.get('theme')?.toString() ?? '';

	if (!includes(cameraModeOptions, cameraMode)) {
		return { ok: false, error: 'Choose a valid default camera mode' };
	}
	if (!includes(leaderboardModeOptions, leaderboardMode)) {
		return { ok: false, error: 'Choose a valid leaderboard mode' };
	}
	if (!includes(themeOptions, theme)) return { ok: false, error: 'Choose a valid theme' };

	return {
		ok: true,
		preferences: {
			cameraMode,
			leaderboardMode,
			theme,
			reducedMotion: formData.has('reducedMotion'),
			highContrast: formData.has('highContrast')
		}
	};
}
