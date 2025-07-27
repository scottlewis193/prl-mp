import { createRace, deleteAllRaces, updateRace } from '$lib/stores/race.svelte';
import { deleteAllRacers, updateRacersByRaceId } from '$lib/stores/racer.svelte';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	const { command }: { command: string } = await request.json();
	const returnData: { message: string } = {
		message: 'Command executed successfully'
	};

	if (!command) {
		return json(returnData);
	}
	const actualCommand: string = command.split(' ')[0];
	const params = command.split(' ').slice(1);

	switch (actualCommand) {
		case '/createrace':
			//since we are creating a new race, we need to clear the clients racers and race data
			const race = await createRace();

			// await createDefaultRacers(race);
			return json(returnData);
		case '/startrace':
			if (params.length === 0) {
				returnData.message = 'No race ID provided';
				return json(returnData);
			}
			await updateRace(params[0], { status: 'running' });
			//we need to update the lastUpdatedAt before starting the race else the racers will end up in weird positions when the simulation starts
			// await updateRacersByRaceId(params[0], { lastUpdatedAt: new Date().toISOString() });
			return json(returnData);
		case '/deleteallraces':
			await deleteAllRaces();
			await deleteAllRacers();
			return json(returnData);
		default:
			returnData.message = 'Invalid command';
			return json(returnData);
	}
};
