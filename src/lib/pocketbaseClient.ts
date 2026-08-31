import PocketBase, { BaseAuthStore } from 'pocketbase';

export function createBrowserPocketBase(url: string): PocketBase {
	const client = new PocketBase(url, new BaseAuthStore());
	client.autoCancellation(false);
	return client;
}
