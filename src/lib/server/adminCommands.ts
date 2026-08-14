import { json } from '@sveltejs/kit';

import { isAdministrativeUser } from '$lib/adminAuthorization';

export type AdminCommandOperations = {
	createUnassignedRacers: () => Promise<number>;
	createRace: () => Promise<{ race: { id?: string }; racerCount: number }>;
	startRace: (raceId: string) => Promise<boolean>;
	deleteAllRaces: () => Promise<void>;
	deleteAllRacers: () => Promise<void>;
};

type CommandEvent = {
	request: Request;
	locals: App.Locals;
};

type CommandResponse = {
	message: string;
};

const RACE_ID_PATTERN = /^[a-z0-9]{15}$/i;
const MAX_COMMAND_LENGTH = 200;

function response(message: string, status = 200): Response {
	return json({ message } satisfies CommandResponse, { status });
}

export function createAdminCommandHandler(operations: AdminCommandOperations) {
	return async ({ request, locals }: CommandEvent): Promise<Response> => {
		if (!locals.user) {
			return response('Administrative access is required', 401);
		}
		if (!isAdministrativeUser(locals.user)) {
			return response('Administrative access is required', 403);
		}

		let payload: unknown;
		try {
			payload = await request.json();
		} catch {
			return response('Request body must be valid JSON', 400);
		}

		if (
			typeof payload !== 'object' ||
			payload === null ||
			!('command' in payload) ||
			typeof payload.command !== 'string'
		) {
			return response('Command must be a string', 400);
		}

		const command = payload.command.trim();
		if (!command || command.length > MAX_COMMAND_LENGTH) {
			return response(`Command must contain between 1 and ${MAX_COMMAND_LENGTH} characters`, 400);
		}

		const [commandName, ...args] = command.split(/\s+/);

		try {
			switch (commandName) {
				case '/createracers': {
					if (args.length > 0) return response('/createracers does not accept arguments', 400);
					const createdRacers = await operations.createUnassignedRacers();
					return response(
						createdRacers > 0
							? `Created ${createdRacers} unassigned racers`
							: 'Racers already exist; no duplicate racers were created'
					);
				}
				case '/createrace': {
					if (args.length > 0) return response('/createrace does not accept arguments', 400);
					const { race, racerCount } = await operations.createRace();
					return response(`Created race ${race.id} with ${racerCount} unassigned racers`);
				}
				case '/startrace': {
					if (args.length !== 1 || !RACE_ID_PATTERN.test(args[0])) {
						return response('/startrace requires one valid race ID', 400);
					}
					if (!(await operations.startRace(args[0]))) {
						return response('Cannot start a race with no racers assigned', 409);
					}
					return response(`Started race ${args[0]}`);
				}
				case '/deleteallraces': {
					if (args.length !== 1 || args[0] !== '--confirm') {
						return response('Destructive command requires: /deleteallraces --confirm', 400);
					}
					await operations.deleteAllRaces();
					await operations.deleteAllRacers();
					return response('Deleted all races and racers');
				}
				default:
					return response('Unknown command', 400);
			}
		} catch (error) {
			console.error(`Administrative command ${commandName} failed`, error);
			return response('Command failed. Check the server logs for details', 500);
		}
	};
}
