import pb from './pocketbase';

export async function processTrainerRosters(
	now = new Date()
): Promise<{ signedRacers: number; releasedRacers: number; createdFreeAgents: number }> {
	const processingDay = new Date(now);
	processingDay.setUTCHours(0, 0, 0, 0);
	const timestamp = processingDay.toISOString();
	return pb.send('/api/prl/rosters/process', {
		method: 'POST',
		body: {
			now: timestamp,
			seed: `world-rosters:${timestamp.slice(0, 10)}`,
			minimumPoolSize: 10,
			targetPoolSize: 25
		}
	}) as Promise<{ signedRacers: number; releasedRacers: number; createdFreeAgents: number }>;
}
