import type { Sprite, Texture } from 'pixi.js';
import type { AuthRecord } from 'pocketbase';
import type { CameraMode, LeaderboardMode, Theme } from './settingsPreferences';
import type { SpeciesAssetState, SpeciesProvenance } from '$lib/species';
import type { RaceFormat } from './raceFormat';
import { createEmptyTrainerCareer } from './trainerCareer';

export type { RaceFormat } from './raceFormat';

export type AwardedPrize = {
	racerId: string;
	position: number;
	classPosition?: number;
	amount: number;
};
export type RaceClassEntry = { racerId: string; classId: string; className: string };
export type RaceClassResult = RaceClassEntry & { overallPosition: number; classPosition: number };

export type RaceValuationReason = {
	type: 'race_result';
	raceId: string;
	position: number;
	fieldSize: number;
	performancePercent: number;
	recentFormPercent: number;
	uncappedPercent: number;
	appliedPercent: number;
};

export type HealthValuationReason = {
	type: 'health';
	conditionId: string;
	transition: 'onset' | 'recovery';
	severity: 'minor' | 'moderate' | 'severe';
	appliedPercent: number;
};

export type RosterValuationReason = {
	type: 'roster_change';
	transition: 'signing' | 'release';
	trainerId: string;
	appliedPercent: number;
};

export type RacerPricePoint = {
	timestamp: string;
	previousPrice?: number;
	price: number;
	change?: number;
	changePercent?: number;
	reason?: string | RaceValuationReason | HealthValuationReason | RosterValuationReason;
	rulesVersion?: string;
	sourceEvent?: string;
};

export type RacerTraits = {
	durability: number;
	resilience: number;
	temperament: number;
	consistency: number;
	potential: number;
	longevity: number;
};

export type RacerLifecycle = {
	traits: RacerTraits;
	generationSeed: string;
	traitRulesVersion: string;
	careerStartedAt: string;
	careerLoad: number;
	health?: RacerHealthProjection;
	retirement?: RacerRetirementProjection;
};

export type RacerRetirementProjection = {
	retiredAt: string;
	reason: 'age' | 'career_load' | 'health';
	rulesVersion: string;
	eventId: string;
	previousTrainer?: { id: string; name: string };
	previousLeague?: { id: string; name: string };
};

export type RacerHealthProjection = {
	eligible: boolean;
	performanceMultiplier: number;
	activeConditionIds: string[];
};

export type RaceCompetitionFormat = {
	type: 'league_race' | 'grand_prix' | 'exhibition' | 'legends_exhibition';
	ranked: boolean;
	rulesVersion: string;
};

export type RaceEligibilityPolicy = {
	activeOnly: boolean;
	healthEligible: boolean;
	leagueId?: string;
	leagueIds?: string[];
	retired: boolean;
	trainerRequired: boolean;
};

export type RaceMovePolicy = { enabled: boolean; rulesVersion: string };
export type RaceRiskPolicy = {
	level: 'low' | 'standard' | 'high';
	incidentMultiplier: number;
	trackRisk: number;
};
export type RaceWageringPolicy = { enabled: boolean; markets: Array<'winner'> };

export type RaceType = {
	id?: string;
	name: string;
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled';
	league?: string;
	season?: string;
	format?: RaceFormat;
	raceFormat?: RaceCompetitionFormat;
	eligibilityPolicy?: RaceEligibilityPolicy;
	racetrack: string;
	winner: string;
	finishingOrder: string[];
	classEntries?: RaceClassEntry[];
	classResults?: RaceClassResult[];
	prizeCurve?: number[];
	pointsCurve?: number[];
	prizeScale?: number;
	movePolicy?: RaceMovePolicy;
	riskPolicy?: RaceRiskPolicy;
	wageringPolicy?: RaceWageringPolicy;
	awardedPrizes?: AwardedPrize[];
	startTime: Date;
	endTime: Date;
	totalLaps: number;
	bettingCutoff?: Date;
	markets?: {
		winnerType?: 'winner';
		winnerName?: string;
		winnerCutoff?: string;
		winnerSelections?: { racerId: string; odds: number }[];
	};
};

export class Race implements RaceType {
	id?: string;
	name: string = 'New Race';
	status: 'pending' | 'countdown' | 'running' | 'finished' | 'cancelled' | 'settled' = 'pending';
	league?: string;
	season?: string;
	format?: RaceFormat = 'circuit';
	raceFormat?: RaceCompetitionFormat = {
		type: 'league_race',
		ranked: true,
		rulesVersion: 'league-race-v1'
	};
	eligibilityPolicy?: RaceEligibilityPolicy = {
		activeOnly: true,
		healthEligible: true,
		leagueId: '',
		retired: false,
		trainerRequired: true
	};
	racetrack: string = '175hl67e5pvjjib';
	winner: string = '';
	finishingOrder: string[] = [];
	classEntries?: RaceClassEntry[] = [];
	classResults?: RaceClassResult[] = [];
	prizeCurve?: number[] = [];
	pointsCurve?: number[] = [];
	prizeScale?: number = 0;
	movePolicy?: RaceMovePolicy = { enabled: false, rulesVersion: 'moves-disabled-v1' };
	riskPolicy?: RaceRiskPolicy = { level: 'standard', incidentMultiplier: 1, trackRisk: 0 };
	wageringPolicy?: RaceWageringPolicy = { enabled: false, markets: [] };
	awardedPrizes?: AwardedPrize[] = [];
	startTime: Date = new Date();
	totalLaps: number = 99;
	endTime: Date = new Date();
	bettingCutoff?: Date;
	markets?: RaceType['markets'];
}

type RacerType = RacerLifecycle & {
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
		finishedAt?: string;
		lapStartTime?: number;
		lapTimes: { [lapNumber: number]: number };
		bestLapTime?: number;
		trackContext?: TrackSimulationContext;
		trainerAtEntry?: TrainerAtRaceEntry;
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
		priceHistory: RacerPricePoint[];
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
	traits: RacerTraits = $state({
		durability: 50,
		resilience: 50,
		temperament: 50,
		consistency: 50,
		potential: 50,
		longevity: 50
	});
	generationSeed: string = $state('');
	traitRulesVersion: string = $state('racer-traits-v1');
	careerStartedAt: string = $state('');
	careerLoad: number = $state(0);
	health: RacerHealthProjection = $state({
		eligible: true,
		performanceMultiplier: 1,
		activeConditionIds: []
	});
	retirement?: RacerRetirementProjection = $state(undefined);
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
		finishedAt?: string;
		lapStartTime?: number;
		lapTimes: { [lapNumber: number]: number };
		bestLapTime?: number;
		trackContext?: TrackSimulationContext;
		trainerAtEntry?: TrainerAtRaceEntry;
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
		priceHistory: RacerPricePoint[];
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
	pokedexNumber: number;
	name: string;
	generation: number;
	mugshot: string;
	spriteSheet: string;
	animData: any;
	stats: {
		hp: number;
		attack: number;
		defense: number;
		spAttack: number;
		spDefense: number;
		specialAttack?: number;
		specialDefense?: number;
		speed: number;
		baseStatTotal: number;
		total?: number;
	};
	moves: any[];

	types: string[];
	provenance: SpeciesProvenance;
	assetState: SpeciesAssetState;
	hp: number;
	attack: number;
	defense: number;
	speed: number;
	overworldImage: string;
	leaderboardImage: string;
};

export class Pokemon implements PokemonType {
	id?: string = '0';
	pokedexNumber: number = 0;
	name: string = '';
	generation: number = 0;
	mugshot: string = '';
	spriteSheet: string = '';
	animData: any = {};
	stats: {
		hp: number;
		attack: number;
		defense: number;
		spAttack: number;
		spDefense: number;
		specialAttack?: number;
		specialDefense?: number;
		speed: number;
		baseStatTotal: number;
		total?: number;
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
	provenance = { source: '', version: '', url: '' };
	assetState: PokemonType['assetState'] = {
		portrait: 'fallback',
		walkAnimation: 'fallback',
		fallbackSpecies: 'pikachu'
	};
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
	budget: number;
	rosterCapacity: number;
	career: TrainerCareer;
};

export type TrainerRecentResult = {
	resultId: string;
	raceId: string;
	racerId: string;
	position: number;
	earnings: number;
	occurredAt: string;
};

export type TrainerCareer = {
	starts: number;
	wins: number;
	podiums: number;
	earnings: number;
	championships: number;
	recentResults: TrainerRecentResult[];
};

export type TrainerRaceResultFact = {
	id: string;
	raceId: string;
	racerId: string;
	trainerId?: string;
	position: number;
	earnings: number;
	occurredAt: string;
	attributionStatus?: TrainerAttributionStatus;
};

export type TrainerAttributionStatus = 'attributed' | 'untrained' | 'unknown_legacy';

export type TrainerAtRaceEntry = {
	status: Exclude<TrainerAttributionStatus, 'unknown_legacy'>;
	trainerId?: string;
};

export type TrainerChampionshipFact = {
	id: string;
	trainerId: string;
	occurredAt: string;
};

export type TrainerRaceResult = {
	id: string;
	race: string;
	racer: string;
	trainer?: string;
	attributionStatus: TrainerAttributionStatus;
	position: number;
	earnings: number;
	occurredAt: string;
	expand?: { race?: Race; racer?: Racer; trainer?: Trainer };
};

export class Trainer implements TrainerType {
	id: string = $state('');
	name: string = $state('');
	motivation: number = $state(1);
	tactics: number = $state(1);
	bond: number = $state(1);
	gender: 'male' | 'female' = $state('male');
	budget: number = $state(0);
	rosterCapacity: number = $state(4);
	career: TrainerCareer = $state(createEmptyTrainerCareer());
}

export type RaceTrackType = {
	id: string;
	name: string;
	checkpoints: { index: number; x: number; y: number }[];
	data: any;
	tileset: string;
	length: number;
	totalLength: number;
	width: number;
	maxSize: { x: number; y: number };
	surface: TrackSurface;
	hazards: TrackHazard[];
	corneringDemand: number;
	speedBias: number;
	risk: number;
	compatibleFormats: RaceFormat[];
};

export type TrackSurface = 'asphalt' | 'dirt' | 'grass' | 'sand' | 'ice';

export type TrackHazard = {
	type: string;
	severity: number;
	checkpointIndex?: number;
};

export type TrackCharacteristics = Pick<
	RaceTrackType,
	| 'length'
	| 'width'
	| 'surface'
	| 'hazards'
	| 'corneringDemand'
	| 'speedBias'
	| 'risk'
	| 'compatibleFormats'
>;

export type RacerSuitabilityInputs = {
	racerSpeed: number;
	racerHandling: number;
	track: TrackCharacteristics;
};

export type IncidentInputs = {
	racerResilience: number;
	trackRisk: number;
	corneringDemand: number;
	hazards: TrackHazard[];
};

export type TrackSimulationContext = {
	trackId: string;
	suitability: RacerSuitabilityInputs;
	incident: IncidentInputs;
	speedMultiplier: number;
};

export class RaceTrack implements RaceTrackType {
	id: string = '';
	name: string = '';
	data: any = {};
	checkpoints: { index: number; x: number; y: number }[] = [];
	tileset: string = '';
	length: number = 0;
	totalLength: number = 0;
	width: number = 0;
	maxSize: { x: number; y: number } = { x: 0, y: 0 };
	surface: TrackSurface = 'asphalt';
	hazards: TrackHazard[] = [];
	corneringDemand: number = 0;
	speedBias: number = 0;
	risk: number = 0;
	compatibleFormats: RaceFormat[] = [];
}

export type User = AuthRecord & {
	id: string;
	name: string;
	email: string;
	avatar: string;
	options: {
		raceViewer: {
			cameraMode?: CameraMode;
			leaderboardMode: LeaderboardMode;
			isViewing: boolean;
		};
		theme?: Theme;
		accessibility?: {
			reducedMotion: boolean;
			highContrast: boolean;
		};
	};
	watchlist: string[];
	isFake: boolean;
	isAdmin: boolean;
	balance: number;
};

export type Holding = {
	id?: string;
	player: string;
	racer: string;
	quantity: number;
	costBasis: number;
};

export type Wager = {
	id?: string;
	player: string;
	race: string;
	market: 'winner';
	selection: string;
	stake: number;
	odds: number;
	potentialPayout: number;
	status: 'open' | 'won' | 'lost' | 'refunded';
	payout: number;
	placedAt: string;
	resolvedAt?: string;
};

export type EventType = {
	id: string;
	type:
		| 'DailyLeagueRaces'
		| 'ExhibitionRace'
		| 'LegendsExhibition'
		| 'GrandPrix'
		| 'RaceSettled'
		| 'HealthOnset'
		| 'HealthRecovery';
	scheduleKey?: string;
	startTime?: Date;
	idempotencyKey?: string;
	occurredAt?: Date;
	facts?: {
		raceId?: string;
		winnerId?: string;
		finishingOrder?: string[];
		classResults?: RaceClassResult[];
		awardedPrizes?: AwardedPrize[];
		seasonPoints?: { racerId: string; position: number; points: number }[];
		racerId?: string;
		conditionId?: string;
		transition?: 'onset' | 'recovery';
	};
	raceIds: string[];
	started: boolean;
	finished: boolean;
};

export type Season = {
	id: string;
	name: string;
	status: 'active' | 'completed';
	startedAt: string;
	endedAt?: string;
	rulesVersion: string;
	pointsCurve: number[];
	movementCount: number;
};

export type LeagueStandingRecord = {
	id: string;
	season: string;
	league: string;
	racer: string;
	points: number;
	starts: number;
	wins: number;
	podiums: number;
	bestFinish: number;
	recentForm: number[];
	updatedAt?: string;
};

export type ExchangePage = {
	activeRacer: Racer | undefined;
	showDetails: boolean;
	holdings: Holding[];
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
