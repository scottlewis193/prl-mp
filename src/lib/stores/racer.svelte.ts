import type { Sprite, Texture } from 'pixi.js';
import PocketBase from 'pocketbase';
import pb from '../pocketbase';

import { getContext, setContext } from 'svelte';
import type { Race } from './race.svelte';
import type { League } from './league.svelte';
import type { Trainer } from './trainer.svelte';

type RacerType = {
	id?: string;
	name: string;
	race?: string;
	league: string;
	trainer: string;

	expand: {
		race?: Race;
		league?: League;
		trainer?: Trainer;
		pokemon?: Pokemon;
	};

	// --- Pokémon Info ---
	pokemon: string;
	// --- Individual Stats ---
	stats: {
		hp: number;
		attack: number;
		defense: number;
		speed: number;
		level: number;
		ranking: number;
		gender: 'male' | 'female';
	};
	// --- ⚠️ Status Flags ---
	status: {
		retired: boolean;
		injured: boolean;
	};
	// --- Race State Stats ---
	currentRace: {
		lapsCompleted: number;
		checkpointIndex: number;
		distanceFromCheckpoint: number;
		lastUpdatedAt: string;
		finished: boolean;
		lapStartTime?: number;
		lapTimes: { [lapNumber: number]: number };
		bestLapTime?: number;
	};
	// --- 🏁 Career Performance ---
	raceHistory: {
		wins: number;
		totalRaces: number;
		averageFinishPosition: number;
		races: {
			raceId: string;
			position: number;
			prizeMoney: number;
			date: string;
		}[];
	};
	// --- Track Appearance ---
	positioning: {
		x: number;
		y: number;
		trackOffset?: number;
		targetTrackOffset: number;
		lastOffsetChangeAt?: number;
	};
	// --- 🧾 Ownership and Shares ---
	ownership: {
		totalShares: number; // e.g., 1000
		shareholders: {
			playerId: string;
			sharesOwned: number;
		}[];
	};
	// --- 📈 Share Price and Market Data ---
	financials: {
		totalEarnings: number; // Total PokéD won
		earningsPerShare: number; // = totalEarnings / totalShares
		lastPayoutAt?: string;
		totalShares: number;
		currentSharePrice: number; // e.g., 12.50 PokéD
		priceHistory: {
			timestamp: string;
			price: number;
			reason?: string; // e.g., "Race Win", "Loss", "Injury"
		}[];
	};

	//-- CLIENT (mainly for interpolation) ---

	// --- Sprite ---
	_frame: number;
	_frames?: Texture[];
	_frameElapsed?: number;
	_lastFrameTime?: number;
	_frameTimer?: number;
	_frameWidth?: number;
	_frameHeight?: number;
	_frameDurations?: number[];
	_pixiSprite?: Sprite;
	_textureSource?: Texture;
	_directionIndex?: number;
	_directionHistory?: number;

	// Local interpolated display position
	_displayX?: number;
	_displayY?: number;

	//-- interpolation ---
	_lastTargetX: number;
	_lastTargetY: number;
	_targetX: number;
	_targetY: number;
	_interpStartTime: number;
	_interpDuration: number;
};

export class Racer implements RacerType {
	id?: string = $state('0');
	name: string = $state('Unknown');
	race?: string = $state('0');
	trainer: string = $state('0');
	league: string = $state('0');
	pokemon: string = $state('0');
	expand: {
		race?: Race;
		league?: League;
		trainer?: Trainer;
		pokemon?: Pokemon;
	} = {};
	stats: {
		hp: number;
		attack: number;
		defense: number;
		speed: number;
		ranking: number;
		level: number;
		gender: 'male' | 'female';
	} = $state({
		hp: 0,
		attack: 0,
		defense: 0,
		speed: 0,
		ranking: 0,
		level: 0,
		gender: 'male'
	});
	status = $state({
		injured: false,
		retired: false
	});
	currentRace: {
		lapsCompleted: number;
		checkpointIndex: number;
		distanceFromCheckpoint: number;
		lastUpdatedAt: string;
		finished: boolean;
		lapStartTime?: number;
		lapTimes: { [lapNumber: number]: number };
		bestLapTime?: number;
	} = $state({
		lapsCompleted: 0,
		checkpointIndex: 0,
		distanceFromCheckpoint: 0,
		lastUpdatedAt: '',
		finished: false,
		lapTimes: {},
		bestLapTime: undefined
	});
	raceHistory: {
		wins: number;
		totalRaces: number;
		averageFinishPosition: number;
		races: { raceId: string; position: number; prizeMoney: number; date: string }[];
	} = $state({
		wins: 0,
		totalRaces: 0,
		averageFinishPosition: 0,
		races: []
	});
	positioning: {
		trackOffset: number;
		lastOffsetChangeAt: number;
		x: number;
		y: number;
		targetTrackOffset: number;
	} = $state({
		trackOffset: 0,
		lastOffsetChangeAt: 0,
		x: 0,
		y: 0,
		targetTrackOffset: 0
	});
	ownership: { totalShares: number; shareholders: { playerId: string; sharesOwned: number }[] } =
		$state({
			totalShares: 0,
			shareholders: []
		});
	financials: {
		totalEarnings: number;
		earningsPerShare: number;
		lastPayoutAt?: string;
		totalShares: number;
		currentSharePrice: number;
		priceHistory: { timestamp: string; price: number; reason?: string }[];
	} = $state({
		totalEarnings: 0,
		earningsPerShare: 0,
		lastPayoutAt: undefined,
		totalShares: 0,
		currentSharePrice: 0,
		priceHistory: []
	});
	_lastTargetX = $state(0);
	_lastTargetY = $state(0);
	_targetX = $state(0);
	_targetY = $state(0);
	_interpStartTime = $state(0);
	_interpDuration = $state(500);
	_frame = $state(0);
	_frames: any[] = $state([]);
	_pixiSprite: Sprite | undefined = $state(undefined);
	_frameDurations: number[] = $state([]);
	_frameElapsed: number | undefined = $state(undefined);
	_displayX?: number | undefined;
	_displayY?: number | undefined;
	_lastFrameTime: number = $state(0);
}

export type SortedRacer = Racer & { progress: number; totalProgress: number; hasBestLap: boolean };

const racersKey = Symbol('racers');
const currentRacersKey = Symbol('currentRacers');
let _racers: Racer[] = $state([]);
export function setRacersContext(racers: Racer[]) {
	_racers = racers;
	return setContext<Racer[]>(racersKey, _racers);
}

export function getRacersContext(): Racer[] {
	return getContext<Racer[]>(racersKey);
}

export function setCurrentRacersContext(racers: Racer[]) {
	const _currentRacers: Racer[] = $state(racers);
	return setContext<Racer[]>(currentRacersKey, _currentRacers);
}

export function getCurrentRacersContext(): Racer[] {
	return getContext<Racer[]>(currentRacersKey);
}

export async function deleteAllRacers() {
	const racersToDelete = await pb.collection('racers').getFullList();

	for (let racer of racersToDelete) {
		await pb.collection('racers').delete(racer.id);
	}
}

export async function getAllRacers() {
	return (await pb
		.collection('racers')
		.getFullList({ expand: 'pokemon,trainer,league' })) as Racer[];
}

export async function getRacers(raceId: string) {
	return (await pb.collection('racers').getFullList({
		filter: `raceId.id = "${raceId}"`
	})) as Racer[];
}

export async function updateRacer(racerId: string, updates: Partial<Racer>): Promise<boolean> {
	try {
		await pb.collection('racers').update(racerId, updates);

		return true;
	} catch (error) {
		console.log('Error updating racer:', racerId);

		return false;
	}
}

export async function updateRacersByRaceId(raceId: string, updates: Partial<Racer>) {
	const racers = await getRacers(raceId);

	await Promise.all(
		racers.map((racer) => {
			racer = { ...racer, ...updates };
			if (!racer.id) return Promise.resolve();
			return updateRacer(racer.id, racer);
		})
	);
}

type PokemonType = {
	id?: number;
	name: string;
	mugshot: string;
	spriteSheet: string;
	animData: any;
	stats: {
		hp: number;
		attack: number;
		defense: number;
		spAttack: number;
		spDefense: number;
		speed: number;
		baseStatTotal: number;
	};
	moves: any[];

	types: string[];
	hp: number;
	attack: number;
	defense: number;
	speed: number;
	overworldImage: string;
	leaderboardImage: string;
};

export class Pokemon implements PokemonType {
	id?: number = 0;
	name: string = '';
	mugshot: string = '';
	spriteSheet: string = '';
	animData: any = {};
	stats: {
		hp: number;
		attack: number;
		defense: number;
		spAttack: number;
		spDefense: number;
		speed: number;
		baseStatTotal: number;
	} = {
		hp: 0,
		attack: 0,
		defense: 0,
		spAttack: 0,
		spDefense: 0,
		speed: 0,
		baseStatTotal: 0
	};
	moves: any[] = [];
	types: string[] = [];
	hp: number = 0;
	attack: number = 0;
	defense: number = 0;
	speed: number = 0;
	overworldImage: string = '';
	leaderboardImage: string = '';
}

export async function subscribeToRacers(racersAry: Racer[], pb: PocketBase) {
	await pb.collection('racers').unsubscribe();
	await pb.collection('racers').subscribe(
		'*',
		async function (e) {
			const racerRecord = e.record as unknown as Racer;

			switch (e.action) {
				case 'create':
					racersAry.push(racerRecord);
					break;
				case 'update':
					updateRacerOnScreen(racerRecord);

					break;
				case 'delete':
					racersAry.splice(
						racersAry.findIndex((r) => r.id === racerRecord.id),
						1
					);
					break;
			}
		},
		{ expand: 'pokemon' }
	);
}

function updateRacerOnScreen(updated: Racer) {
	const i = _racers.findIndex((r) => r.id === updated.id);

	if (i === -1) {
		_racers.push(updated);
	} else {
		if (_racers[i] === _racers[0]) {
			// console.log(_racers[i], updated);
		}

		Object.assign(_racers[i], updated);

		const now = performance.now();

		//interpolation
		_racers[i]._lastTargetX = _racers[i]._targetX;
		_racers[i]._lastTargetY = _racers[i]._targetY;
		_racers[i]._targetX = updated.positioning.x;
		_racers[i]._targetY = updated.positioning.y;
		_racers[i]._interpStartTime = now;
		_racers[i]._interpDuration = 500; // milliseconds
	}
}

export async function unsubscribeFromRacers(pb: PocketBase) {
	if (!pb) return;
	await pb.collection('racers').unsubscribe();
}
