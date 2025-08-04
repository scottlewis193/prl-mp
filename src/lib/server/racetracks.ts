import type { RaceTrackType } from '$lib/types';
import pb from '../pocketbase';

export async function getAllRacetracks() {
	return (await pb.collection('racetracks').getFullList()) as RaceTrackType[];
}
