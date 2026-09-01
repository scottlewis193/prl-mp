import 'dotenv/config';

import assert from 'node:assert/strict';
import PocketBase from 'pocketbase';
import { resolvePocketBaseUrl } from '../src/lib/pocketbase-url.js';
import { verifySpeciesCollectionSchema } from '../src/lib/server/speciesCatalogueSchema.js';

const baseUrl = resolvePocketBaseUrl(process.env.PUBLIC_PB_URL);
const userEmail = process.env.PB_USER;
const userPassword = process.env.PB_PASS;
const superuserEmail = process.env.PB_SUPERUSER_EMAIL;
const superuserPassword = process.env.PB_SUPERUSER_PASS;

assert(userEmail && userPassword, 'PB_USER and PB_PASS must be configured');
assert(
	superuserEmail && superuserPassword,
	'PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASS must be configured'
);

const expectedCollections = [
	'accountLedger',
	'events',
	'holdings',
	'leagues',
	'pokemon',
	'racers',
	'races',
	'racetracks',
	'simulator_leases',
	'subscriptions',
	'trainers',
	'users',
	'wagers'
];

const pb = new PocketBase(baseUrl);
const adminPb = new PocketBase(baseUrl);
const cleanup = [];

try {
	await pb.health.check();
	await pb.collection('users').authWithPassword(userEmail, userPassword);
	await adminPb.collection('_superusers').authWithPassword(superuserEmail, superuserPassword);

	const collectionNames = (await adminPb.collections.getFullList())
		.map((collection) => collection.name)
		.filter((name) => expectedCollections.includes(name))
		.sort();
	assert.deepEqual(collectionNames, expectedCollections);
	const pokemonCollection = await adminPb.collections.getOne('pokemon');
	verifySpeciesCollectionSchema(pokemonCollection);
	const species = await pb.collection('pokemon').getFullList({ batch: 1_000 });
	assert.equal(species.length, 649, 'Pokemon catalogue must contain exactly 649 records');
	assert.equal(
		new Set(species.map(({ pokedexNumber }) => pokedexNumber)).size,
		649,
		'Pokemon catalogue must contain 649 unique National Pokédex numbers'
	);

	const trainer = await pb.collection('trainers').create({
		name: 'Schema Test Trainer',
		motivation: 1,
		tactics: 1,
		bond: 1,
		gender: 'female'
	});
	cleanup.push(() => pb.collection('trainers').delete(trainer.id));

	const league = await pb.collection('leagues').create({
		name: `Schema Test League ${Date.now()}`,
		prizeMoneyScaling: 1,
		minRanking: 1,
		maxRanking: 20,
		maxPlayers: 20
	});
	cleanup.push(() => pb.collection('leagues').delete(league.id));

	const pokemon = species[0];

	const racetrack = await pb.collection('racetracks').create({
		name: 'Schema Test Track',
		checkpoints: [
			{ index: 0, x: 0, y: 0 },
			{ index: 1, x: 100, y: 0 }
		],
		data: { layers: [], tilesets: [] },
		totalLength: 100,
		width: 64,
		maxSize: { x: 100, y: 100 }
	});
	cleanup.push(() => pb.collection('racetracks').delete(racetrack.id));

	const race = await pb.collection('races').create({
		name: 'Schema Test Race',
		status: 'pending',
		league: league.id,
		racetrack: racetrack.id,
		startTime: new Date().toISOString(),
		totalLaps: 5
	});
	cleanup.push(() => pb.collection('races').delete(race.id));

	const racer = await pb.collection('racers').create({
		name: 'Schema Test Racer',
		race: race.id,
		league: league.id,
		trainer: trainer.id,
		pokemon: pokemon.id,
		traits: {
			durability: 50,
			resilience: 50,
			temperament: 50,
			consistency: 50,
			potential: 50,
			longevity: 50
		},
		generationSeed: 'schema-test-racer',
		traitRulesVersion: 'racer-traits-v1',
		careerStartedAt: new Date().toISOString(),
		careerLoad: 0,
		stats: { speed: 10, ranking: 1 },
		status: { retired: false, injured: false },
		currentRace: { lapsCompleted: 0, checkpointIndex: 0, distanceFromCheckpoint: 0 },
		raceHistory: { wins: 0, totalRaces: 0, races: [] },
		positioning: { x: 0, y: 0, targetTrackOffset: 0 },
		ownership: { totalShares: 0, shareholders: [] },
		financials: { currentSharePrice: 0, priceHistory: [] }
	});
	cleanup.push(() => pb.collection('racers').delete(racer.id));

	const expandedRacer = await pb.collection('racers').getOne(racer.id, {
		expand: 'pokemon,trainer,league,race'
	});
	assert.equal(expandedRacer.expand.pokemon.id, pokemon.id);
	assert.equal(expandedRacer.expand.trainer.id, trainer.id);
	assert.equal(expandedRacer.expand.league.id, league.id);
	assert.equal(expandedRacer.expand.race.id, race.id);

	const event = await pb.collection('events').create({
		type: 'DailyLeagueRaces',
		scheduleKey: `schema-test-${Date.now()}`,
		startTime: new Date().toISOString(),
		raceIds: [race.id],
		started: false,
		finished: false
	});
	cleanup.push(() => pb.collection('events').delete(event.id));
	assert.deepEqual(event.raceIds, [race.id]);

	const subscription = await pb.collection('subscriptions').create({
		endpoint: `https://push.example.test/${Date.now()}`,
		keys: { p256dh: 'test', auth: 'test' }
	});
	cleanup.push(() => pb.collection('subscriptions').delete(subscription.id));

	const normalEmail = `schema-test-${Date.now()}@example.com`;
	const normalPassword = 'schema-test-password';
	const normalUser = await adminPb.send('/api/prl/accounts/register', {
		method: 'POST',
		body: {
			email: normalEmail,
			password: normalPassword,
			passwordConfirm: normalPassword
		}
	});
	cleanup.push(() => adminPb.collection('users').delete(normalUser.id));

	const normalPb = new PocketBase(baseUrl);
	await normalPb.collection('users').authWithPassword(normalEmail, normalPassword);
	assert.equal(normalPb.authStore.record.balance, 10_000);
	assert.deepEqual(
		(await normalPb.collection('accountLedger').getFullList()).map((entry) => entry.type),
		['account_opened']
	);
	await assert.rejects(
		normalPb.collection('leagues').create({
			name: 'Unauthorized League',
			prizeMoneyScaling: 1,
			minRanking: 1,
			maxRanking: 1,
			maxPlayers: 1
		})
	);
	assert.deepEqual(await normalPb.collection('subscriptions').getFullList(), []);

	console.log(`PocketBase schema verified: ${expectedCollections.join(', ')}`);
} finally {
	for (const remove of cleanup.reverse()) {
		await remove().catch(() => undefined);
	}
}
