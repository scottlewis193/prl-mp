import PocketBase, { BaseAuthStore } from 'pocketbase';

export class NodePocketBase extends PocketBase {
	constructor(baseURL: string) {
		super(baseURL, new BaseAuthStore());
	}

	override buildURL(path = ''): string {
		if (!path) return this.baseURL;
		return `${this.baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
	}
}
