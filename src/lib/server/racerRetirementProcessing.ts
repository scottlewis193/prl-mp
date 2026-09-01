import pb from './pocketbase';

export async function processRacerRetirements(
	now = new Date()
): Promise<{ retiredRacers: number }> {
	const processingDay = new Date(now);
	processingDay.setUTCHours(0, 0, 0, 0);
	const timestamp = processingDay.toISOString();
	return pb.send('/api/prl/retirements/process', {
		method: 'POST',
		body: { now: timestamp, seed: `world-retirement:${timestamp.slice(0, 10)}` }
	}) as Promise<{ retiredRacers: number }>;
}
