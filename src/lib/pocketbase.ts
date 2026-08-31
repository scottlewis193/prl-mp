import { PUBLIC_PB_URL } from '$env/static/public';
import { resolvePocketBaseUrl } from '$lib/pocketbase-url';
import { createBrowserPocketBase } from '$lib/pocketbaseClient';

const pb = createBrowserPocketBase(resolvePocketBaseUrl(PUBLIC_PB_URL));
export default pb;
