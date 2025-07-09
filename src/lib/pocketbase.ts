import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.collection('users').authWithPassword('sl193@pm.me', 'Drag0n1t3694793!!!');

// globally disable auto cancellation
pb.autoCancellation(false);

export default pb;
