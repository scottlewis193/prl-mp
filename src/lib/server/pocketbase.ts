import { PUBLIC_PB_URL } from '$env/static/public';
import { PB_USER, PB_PASS } from '$env/static/private';
import PocketBase from 'pocketbase';

const pb = new PocketBase(PUBLIC_PB_URL);
await pb.collection('users').authWithPassword(PB_USER, PB_PASS);
// globally disable auto cancellation
pb.autoCancellation(false);
export default pb;
