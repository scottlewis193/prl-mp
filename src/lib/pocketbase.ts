import { PUBLIC_PB_URL } from '$env/static/public';
import PocketBase from 'pocketbase';

const pb = new PocketBase(PUBLIC_PB_URL);
await pb.collection('users').authWithPassword('sl193@pm.me', 'Drag0n1t3694793!!!');
// globally disable auto cancellation
pb.autoCancellation(false);
export default pb;
