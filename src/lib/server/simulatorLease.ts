import type { Race, Racer } from '$lib/types';
import pb from './pocketbase';

type LeaseResponse = { acquired: boolean; token?: number };

export type SimulatorLeaseGrant = {
	ownerId: string;
	token: number;
};

export type RacerSimulationUpdate = Pick<Racer, 'currentRace' | 'positioning' | 'stats'> & {
	id: string;
};

export async function claimSimulatorLease(
	ownerId: string,
	ttlMs: number
): Promise<SimulatorLeaseGrant | undefined> {
	const response = (await pb.send('/api/prl/simulator/lease', {
		method: 'POST',
		body: { ownerId, ttlMs }
	})) as LeaseResponse;

	return response.acquired && response.token !== undefined
		? { ownerId, token: response.token }
		: undefined;
}

export async function commitRaceSimulation(
	lease: SimulatorLeaseGrant,
	racerUpdates: RacerSimulationUpdate[],
	raceUpdate?: Pick<Race, 'id' | 'status' | 'winner'>
): Promise<boolean> {
	const response = (await pb.send('/api/prl/simulator/commit', {
		method: 'POST',
		body: { ...lease, racerUpdates, raceUpdate }
	})) as { committed: boolean };

	return response.committed;
}
