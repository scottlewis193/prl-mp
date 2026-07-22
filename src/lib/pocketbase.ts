import { PUBLIC_PB_URL } from '$env/static/public';
import PocketBase from 'pocketbase';
import { resolvePocketBaseUrl } from '$lib/pocketbase-url';

const pb = new PocketBase(resolvePocketBaseUrl(PUBLIC_PB_URL));

// globally disable auto cancellation
pb.autoCancellation(false);
export default pb;
