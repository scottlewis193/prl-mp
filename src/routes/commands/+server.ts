import { createUnassignedRacers, deleteAllRacers } from '$lib/server/racers';
import { createRace, deleteAllRaces, startRace } from '$lib/server/races';
import { createAdminCommandHandler, type AdminCommandOperations } from '$lib/server/adminCommands';
import type { RequestHandler } from '@sveltejs/kit';

const operations: AdminCommandOperations = {
	createUnassignedRacers,
	createRace,
	startRace,
	deleteAllRaces,
	deleteAllRacers
};

export const POST: RequestHandler = createAdminCommandHandler(operations);
