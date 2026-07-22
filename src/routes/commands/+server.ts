import { createUnassignedRacers, deleteAllRacers } from '$lib/server/racers';
import { createRace, deleteAllRaces, startRace } from '$lib/server/races';
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
		case '/createracers':
			const createdRacers = await createUnassignedRacers();
			returnData.message =
				createdRacers > 0
					? `Created ${createdRacers} unassigned racers`
					: 'Racers already exist; no duplicate racers were created';
			return json(returnData);
		case '/createrace':
			const { race, racerCount } = await createRace();
			returnData.message = `Created race ${race.id} with ${racerCount} unassigned racers`;
			return json(returnData);
		case '/startrace':
			if (params.length === 0) {
				returnData.message = 'No race ID provided';
				return json(returnData);
			}
			if (!(await startRace(params[0]))) {
				returnData.message = 'Cannot start a race with no racers assigned';
				return json(returnData, { status: 400 });
			}
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
