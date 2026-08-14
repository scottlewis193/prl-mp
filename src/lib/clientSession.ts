export async function finishClientLogout<Result>(
	authStore: { clear(): void },
	result: Result,
	applyResult: (result: Result) => void | Promise<void>
): Promise<void> {
	authStore.clear();
	await applyResult(result);
}
