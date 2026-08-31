type AutoCancellationClient = {
	autoCancellation(enabled: boolean): unknown;
};

export function configureRequestPocketBase<T extends AutoCancellationClient>(client: T): T {
	client.autoCancellation(false);
	return client;
}
