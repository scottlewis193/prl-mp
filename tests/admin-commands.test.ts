import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createAdminCommandHandler,
	type AdminCommandOperations
} from '../src/lib/server/adminCommands';

const serviceUser = { id: 'prlserviceuser0', isAdmin: false };
const administrator = { id: 'admin-user', isAdmin: true };
const ordinaryUser = { id: 'ordinary-user', isAdmin: false };

function commandRequest(command: unknown): Request {
	return new Request('http://localhost/commands', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ command })
	});
}

function operations(overrides: Partial<AdminCommandOperations> = {}): AdminCommandOperations {
	return {
		createUnassignedRacers: async () => 4,
		createRace: async () => ({ race: { id: 'race00000000001' }, racerCount: 4 }),
		startRace: async () => true,
		deleteAllRaces: async () => undefined,
		deleteAllRacers: async () => undefined,
		...overrides
	};
}

async function execute(
	command: unknown,
	user: typeof administrator | null,
	overrides: Partial<AdminCommandOperations> = {}
) {
	const handler = createAdminCommandHandler(operations(overrides));
	const response = await handler({
		request: commandRequest(command),
		locals: { user },
		url: new URL('http://localhost/commands')
	} as never);

	return { response, body: (await response.json()) as { message: string } };
}

test('administrative commands reject anonymous and ordinary authenticated users', async () => {
	for (const [user, status] of [
		[null, 401],
		[ordinaryUser, 403]
	] as const) {
		let commandRan = false;
		const { response, body } = await execute('/createracers', user, {
			createUnassignedRacers: async () => {
				commandRan = true;
				return 1;
			}
		});

		assert.equal(response.status, status);
		assert.equal(commandRan, false);
		assert.match(body.message, /administrative access/i);
	}
});

test('an administrator can execute a supported command', async () => {
	const { response, body } = await execute('/createrace', administrator);

	assert.equal(response.status, 200);
	assert.equal(body.message, 'Created race race00000000001 with 4 unassigned racers');
});

test('the service account can execute a supported command', async () => {
	let startedRaceId = '';
	const { response, body } = await execute('/startrace race00000000001', serviceUser, {
		startRace: async (raceId) => {
			startedRaceId = raceId;
			return true;
		}
	});

	assert.equal(response.status, 200);
	assert.equal(startedRaceId, 'race00000000001');
	assert.equal(body.message, 'Started race race00000000001');
});

test('command input must be a known command string with valid arguments', async () => {
	for (const [command, expectedMessage] of [
		[42, /command must be a string/i],
		['/unknown', /unknown command/i],
		['/createrace unexpected', /does not accept arguments/i],
		['/startrace invalid-id', /valid race ID/i]
	] as const) {
		const { response, body } = await execute(command, administrator);

		assert.equal(response.status, 400);
		assert.match(body.message, expectedMessage);
	}
});

test('deleting all races requires explicit confirmation before anything is deleted', async () => {
	let deletionRan = false;
	const { response, body } = await execute('/deleteallraces', administrator, {
		deleteAllRaces: async () => {
			deletionRan = true;
		}
	});

	assert.equal(response.status, 400);
	assert.equal(deletionRan, false);
	assert.match(body.message, /--confirm/);
});

test('an administrator can explicitly confirm deletion of all races and racers', async () => {
	const calls: string[] = [];
	const { response, body } = await execute('/deleteallraces --confirm', administrator, {
		deleteAllRaces: async () => {
			calls.push('races');
		},
		deleteAllRacers: async () => {
			calls.push('racers');
		}
	});

	assert.equal(response.status, 200);
	assert.deepEqual(calls, ['races', 'racers']);
	assert.equal(body.message, 'Deleted all races and racers');
});

test('destructive command failures return an operator-safe error response', async () => {
	const { response, body } = await execute('/deleteallraces --confirm', administrator, {
		deleteAllRacers: async () => {
			throw new Error('PocketBase connection secret');
		}
	});

	assert.equal(response.status, 500);
	assert.equal(body.message, 'Command failed. Check the server logs for details');
});

test('race start failures return an operator-safe error response', async () => {
	const { response, body } = await execute('/startrace race00000000001', administrator, {
		startRace: async () => {
			throw new Error('race update failed');
		}
	});

	assert.equal(response.status, 500);
	assert.equal(body.message, 'Command failed. Check the server logs for details');
});
