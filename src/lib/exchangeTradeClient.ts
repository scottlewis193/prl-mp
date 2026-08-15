import type { Holding } from '$lib/types';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { TradeOrder, TradeResult } from './exchangeTrade';

export async function executeAndRefreshTrade(
	pb: PocketBase,
	racerId: string,
	order: TradeOrder
): Promise<{ user: RecordModel; holding: Holding; availableSupply: number }> {
	await pb.send<TradeResult>('/api/prl/economy/trade', {
		method: 'POST',
		body: { racerId, ...order }
	});

	const [auth, holding, racer] = await Promise.all([
		pb.collection('users').authRefresh(),
		pb.collection('holdings').getFirstListItem(pb.filter('racer = {:racerId}', { racerId }), {
			fields: 'id,player,racer,quantity,costBasis'
		}),
		pb.collection('racers').getOne(racerId, { fields: 'financials' })
	]);

	return {
		user: auth.record,
		holding: holding as unknown as Holding,
		availableSupply: Number(racer.financials?.outstandingShares ?? 0)
	};
}
