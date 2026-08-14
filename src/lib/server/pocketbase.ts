import { PUBLIC_PB_URL } from '$env/static/public';
import { PB_USER, PB_PASS } from '$env/static/private';
import { resolvePocketBaseUrl } from '$lib/pocketbase-url';
import PocketBase from 'pocketbase';
import { SERVICE_USER_ID } from '$lib/adminAuthorization';

const pb = new PocketBase(resolvePocketBaseUrl(PUBLIC_PB_URL));

export const SERVER_USER_ID = SERVICE_USER_ID;
export const hasServerCredentials = Boolean(PB_USER && PB_PASS);

export async function authenticateServer(): Promise<void> {
	if (!hasServerCredentials) return;
	if (pb.authStore.isValid) return;

	await pb.collection('users').authWithPassword(PB_USER, PB_PASS);
}

// globally disable auto cancellation
pb.autoCancellation(false);
export default pb;
