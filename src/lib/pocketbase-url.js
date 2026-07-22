export const DEFAULT_POCKETBASE_URL = 'http://127.0.0.1:8090';

/** @param {string | undefined} configuredUrl */
export function resolvePocketBaseUrl(configuredUrl) {
	const url = configuredUrl?.trim() || DEFAULT_POCKETBASE_URL;

	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error();
	} catch {
		throw new Error(
			`PUBLIC_PB_URL must be an absolute HTTP(S) URL (received ${JSON.stringify(url)})`
		);
	}

	return url;
}
