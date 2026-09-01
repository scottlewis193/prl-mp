import pb from './pocketbase';

export type RacerHealthProcessingResult = {
	createdConditions: number;
	recoveredConditions: number;
};

export async function processRacerHealth(now = new Date()): Promise<RacerHealthProcessingResult> {
	const processingDay = new Date(now);
	processingDay.setUTCHours(0, 0, 0, 0);
	const timestamp = processingDay.toISOString();
	return pb.send('/api/prl/health/process', {
		method: 'POST',
		body: { now: timestamp, seed: `world-health:${timestamp.slice(0, 10)}` }
	}) as Promise<RacerHealthProcessingResult>;
}
