import type { Sprite, Texture } from 'pixi.js';
import type { AuthRecord } from 'pocketbase';

export type RaceType = {
	id?: string;
	name: string;
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled';
	racetrack: string;
	winner: string;
	startTime: Date;
	endTime: Date;
	totalLaps: number;
};

export class Race implements RaceType {
	id: string = '0';
	name: string = '';
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled' = 'pending';
	racetrack: string = '175hl67e5pvjjib';
	winner: string = '';
	startTime: Date = new Date();
	totalLaps: number = 99;
	endTime: Date = new Date();
}

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
		issuedShares: number;
		outstandingShares: number;
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

	_active: boolean;
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
		issuedShares: number;
		outstandingShares: number;
		currentSharePrice: number;
		priceHistory: { timestamp: string; price: number; reason?: string }[];
	} = $state({
		totalEarnings: 0,
		earningsPerShare: 0,
		lastPayoutAt: undefined,
		issuedShares: 0,
		outstandingShares: 0,
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
	_active: boolean = $state(false);
}

export type SortedRacer = Racer & { progress: number; totalProgress: number; hasBestLap: boolean };

export type PokemonType = {
	id?: string;
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
	id?: string = '0';
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

export type TrainerType = {
	id: string;
	name: string;
	motivation: number;
	tactics: number;
	bond: number;
	gender: 'male' | 'female';
};

export class Trainer implements TrainerType {
	id: string = $state('');
	name: string = $state('');
	motivation: number = $state(1);
	tactics: number = $state(1);
	bond: number = $state(1);
	gender: 'male' | 'female' = $state('male');
}

export type RaceTrackType = {
	id: string;
	name: string;
	checkpoints: { index: number; x: number; y: number }[];
	data: any;
	tileset: string;
	totalLength: number;
	width: number;
	maxSize: { x: number; y: number };
};

export class RaceTrack implements RaceTrackType {
	id: string = '';
	name: string = '';
	data: any = {};
	checkpoints: { index: number; x: number; y: number }[] = [];
	tileset: string = '';
	totalLength: number = 0;
	width: number = 0;
	maxSize: { x: number; y: number } = { x: 0, y: 0 };
}

export type User = AuthRecord & {
	id: string;
	name: string;
	email: string;
	avatar: string;
	options: {
		raceViewer: {
			leaderboardMode: 'interval' | 'leader';
			isViewing: boolean;
		};
	};
	watchlist: string[];
	isFake: boolean;
};

export type EventType = {
	id: string;
	type: 'DailyLeagueRaces';
	startTime: Date;
	raceIds: string[];
	started: boolean;
	finished: boolean;
};

export type ExchangePage = {
	activeRacer: Racer | undefined;
	showDetails: boolean;
};

export type LeagueType = {
	id: string;
	name: string;
	prizeMoneyScaling: number;
	minRanking: number;
	maxRanking: number;
	maxPlayers: number;
};

export class League implements LeagueType {
	id: string = $state('');
	name: string = $state('');
	prizeMoneyScaling: number = $state(1);
	minRanking: number = $state(1);
	maxRanking: number = $state(1);
	maxPlayers: number = $state(1);
}

export interface Camera {
	mode: 'free' | 'follow';
	targetRacerId: string | null;
	x: number;
	y: number;
	zoom: number;
	isPanning: boolean;
	lastMouse: { x: number; y: number };
}
