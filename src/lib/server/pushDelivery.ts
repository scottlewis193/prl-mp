export function isExpiredPushEndpoint(error: unknown): boolean {
	if (!error || typeof error !== 'object' || !('statusCode' in error)) return false;
	return error.statusCode === 404 || error.statusCode === 410;
}
