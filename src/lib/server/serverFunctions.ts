import { Race, type RaceType } from '$lib/stores/race.svelte';
import type { Racer } from '$lib/stores/racer.svelte';

import pb from '../pocketbase';
import type { League } from '$lib/stores/league.svelte';
import type { SHA512_256 } from 'bun';
import type { EventType } from '$lib/stores/event.svelte';
import type { User } from '$lib/stores/user.svelte';
import type { RaceTrack } from '$lib/stores/racetrack.svelte';

export function startLapTimer(racers: Racer[]) {
	for (const racer of racers) {
		//init lap timer
		if (!racer.currentRace.lapStartTime) {
			racer.currentRace.lapStartTime = Date.now() / 1000;
		}
	}
}

export function recordLapTime(racer: Racer, lapNumber: number) {
	if (!racer.currentRace.lapStartTime) {
		return;
	}
	const lapTime = Number((Date.now() / 1000 - racer.currentRace.lapStartTime).toFixed(3));

	racer.currentRace.lapTimes[lapNumber] = lapTime;
	racer.currentRace.bestLapTime =
		racer.currentRace.bestLapTime !== undefined && racer.currentRace.bestLapTime !== 0
			? Math.min(racer.currentRace.bestLapTime, lapTime)
			: lapTime;
	racer.currentRace.lapStartTime = undefined;
}

export function resolveOvertaking(racers: Racer[], now: number, race: Race) {
	const laneSpacing = 0.4; // adjust as needed
	const cooldown = 1000;

	// Available lane offsets (5 lanes: -2 to +2)
	const possibleLanes = [-2, -1, 0, 1, 2].map((i) => i * laneSpacing);

	// Sort racers by progress
	const sorted = [...racers].sort(
		(a, b) =>
			b.currentRace.lapsCompleted - a.currentRace.lapsCompleted ||
			b.currentRace.checkpointIndex - a.currentRace.checkpointIndex ||
			b.currentRace.distanceFromCheckpoint - a.currentRace.distanceFromCheckpoint
	);

	// Track lane usage per segment
	const laneReservations = new Map<string, Set<number>>();

	function getOccupiedLanes(segmentKey: string, racetrack: RaceTrack): Set<number> {
		if (!laneReservations.has(segmentKey)) {
			laneReservations.set(segmentKey, new Set());
		}
		return laneReservations.get(segmentKey)!;
	}

	// Assign each racer to a lane
	for (let i = 0; i < sorted.length; i++) {
		const racer = sorted[i];

		const nextCheckpoint =
			(racer.currentRace.checkpointIndex + 1) % Object.values(racetrack.checkpoints).length;
		const segmentKey = `${racer.currentRace.lapsCompleted}-${racer.currentRace.checkpointIndex}-${nextCheckpoint}`;
		const occupiedLanes = getOccupiedLanes(segmentKey, racetrack);

		// If cooldown expired or never set, try to assign a lane
		if (
			!racer.positioning.lastOffsetChangeAt ||
			now - racer.positioning.lastOffsetChangeAt > cooldown
		) {
			// If already close to another racer, find a clear lane
			let laneFound = false;

			for (let j = 0; j < i; j++) {
				const ahead = sorted[j];
				if (ahead.currentRace.checkpointIndex !== racer.currentRace.checkpointIndex) continue;

				const gap = Math.abs(
					ahead.currentRace.distanceFromCheckpoint - racer.currentRace.distanceFromCheckpoint
				);
				if (gap < 60) {
					// Racer is close to someone ahead — try to dodge
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.positioning.targetTrackOffset = lane;
							racer.positioning.lastOffsetChangeAt = now;
							occupiedLanes.add(lane);
							laneFound = true;
							break;
						}
					}
					break; // only check first nearby ahead racer
				}
			}

			if (!laneFound) {
				// Not near anyone — try to stay or return to center
				if (!occupiedLanes.has(0)) {
					racer.positioning.targetTrackOffset = 0;
					occupiedLanes.add(0);
				} else {
					// Center lane blocked, pick any free
					for (const lane of possibleLanes) {
						if (!occupiedLanes.has(lane)) {
							racer.positioning.targetTrackOffset = lane;
							occupiedLanes.add(lane);
							break;
						}
					}
				}
			}
		} else {
			// Lane is locked by cooldown — re-reserve it
			occupiedLanes.add(racer.positioning.targetTrackOffset ?? 0);
		}
	}
}

// export async function createDefaultRacers(race: Race) {
// 	for (let i = 0; i < 20; i++) {
// 		const newPokemon = await createRandomPokemon();
// 		const newRacer: Partial<Racer> = {
// 			pokemon: newPokemon,
// 			name: newPokemon.name,
// 			race: race.id
// 		};

// 		await pb.collection('racers').create(newRacer);
// 	}
// }

// export async function createRace() {
// 	const race = (await pb
// 		.collection('races')
// 		.create(JSON.parse(JSON.stringify(new Race())))) as Race;
// 	await createDefaultRacers(race);
// 	return race;
// }

//here we are going 5 days worth of races as this will cover every single pokemon in every league
// so we will create 1 race for each league for each day so we will create 25 races in total to cover the 5 days
export async function create5DayLeagueEvents() {
	//create date variable equal to todays date at 2pm;
	let raceDate = new Date();
	raceDate.setHours(14, 0, 0, 0);

	let racers = await pb.collection('racers').getFullList({ batch: 1000 });
	let leagues = await pb.collection('leagues').getFullList();

	for (let i = 0; i < 5; i++) {
		let leagueRacesForDay = [];
		for (const league of leagues) {
			let leagueRacers = racers.filter((racer) => racer.league === league.id);

			//create race for league
			const raceObj: Partial<RaceType> = {
				name: `League ${league.name} Race`,
				status: 'pending',
				totalLaps: 5,
				racetrack: '175hl67e5pvjjib'
			};
			const leagueRace = await pb.collection('races').create(JSON.parse(JSON.stringify(raceObj)));
			leagueRacesForDay.push(leagueRace);
		}

		//create event for days races
		const eventObj: Partial<EventType> = {
			type: 'DailyLeagueRaces',
			startTime: raceDate,
			started: false,
			finished: false,
			raceIds: leagueRacesForDay.map((race) => race.id)
		};
		const event = await pb.collection('events').create(JSON.parse(JSON.stringify(eventObj)));

		raceDate.setDate(raceDate.getDate() + 1);
	}
}

// export async function buyShares(racer: Racer, investor: User, amount: number) {
// 	// Check balance
// 	const cost = amount * racer.share_price;
// 	if (investor.cash < cost) return;

// 	// Deduct cash
// 	await pb.collection('users').update(investor.id, {
// 		cash: investor.cash - cost
// 	});

// 	// Update ownership
// 	await updatePortfolio(investor.id, racer.id, +amount);
// }

// export async function sellShares(racer: Racer, investor: User, amount: number) {
// 	const sharesOwned = getSharesOwned(investor, racer);
// 	if (sharesOwned < amount) return;

// 	// Add cash
// 	const profit = amount * racer.share_price;
// 	await pb.collection('users').update(investor.id, {
// 		cash: investor.cash + profit
// 	});

// 	// Reduce portfolio
// 	await updatePortfolio(investor.id, racer.id, -amount);
// }

// export function simulateInvestorActions(racer: Racer, investors: User[]) {
// 	const actions = [];

// 	for (const investor of investors) {
// 		// Skip if investor is inactive
// 		if (Math.random() < 0.05) continue;

// 		const score = getPerformanceScore(racer);

// 		// Buy logic
// 		if (score > 5 && Math.random() < 0.3) {
// 			actions.push({ type: 'buy', investor, amount: randomBetween(1, 3) });
// 		}

// 		// Sell logic
// 		if (score < 0 && Math.random() < 0.4) {
// 			actions.push({ type: 'sell', investor, amount: randomBetween(1, 2) });
// 		}
// 	}

//	return actions;
//}

// function getPerformanceScore(racer: Racer) {
// 	// Assume pokemon.lastResults is an array like [1, 5, 2, 18, 3]
// 	const results = racer.lastResults || [];
// 	if (results.length === 0) return 0;

// 	let score = 0;

// 	for (const position of results) {
// 		if (position <= 3) {
// 			score += 3; // podium
// 		} else if (position <= 10) {
// 			score += 1; // mid-pack
// 		} else {
// 			score -= 1; // bad finish
// 		}
// 	}

// 	// Bonus for streaks (e.g. top 5 consistently)
// 	const topFiveStreak = results.slice(0, 3).every((p) => p <= 5);
// 	if (topFiveStreak) score += 2;

// 	// Slightly weight by league (e.g. league 0 = top, league 4 = bottom)
// 	if (pokemon.league !== undefined) {
// 		score += 4 - pokemon.league; // higher leagues add more points
// 	}

// 	// Optional: boost high-speed racers
// 	if (pokemon.stats?.speed > 80) score += 1;

// 	return score;
// }

// export function calculateSharePrice(racer: Racer) {
// 	const base = racer.basePrice ?? 100;

// 	// Performance: last 5 races
// 	let score = 0;
// 	for (const result of racer.last5Races ?? []) {
// 		if (result === 'win') score += 3;
// 		else if (result === 'top5') score += 2;
// 		else if (result === 'bottom5') score -= 1;
// 		else if (result === 'dnf') score -= 2;
// 	}

// 	const performanceBoost = score * 10;

// 	// Demand (number of unique investors)
// 	const demandMultiplier = 1 + Math.log2(1 + (racer.totalShareholders ?? 0)) * 0.05;

// 	// League bonus (1 = top league)
// 	const leagueBonus = (6 - (racer.league ?? 5)) * 20;

// 	// Decay for missing races
// 	const decay = (racer.racesMissed ?? 0) * 5;

// 	// Add controlled randomness
// 	const randomNoise = Math.floor((Math.random() - 0.5) * 10); // ±5

// 	const rawPrice = (base + performanceBoost + leagueBonus) * demandMultiplier - decay + randomNoise;

// 	return Math.max(1, Math.floor(rawPrice));
// }
