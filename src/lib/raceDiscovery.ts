import type { Race, Racer, RaceTrackType } from './types';
import { getTrackCharacteristics } from './trackCharacteristics';

export type RaceDiscoveryGroups = {
	upcoming: Race[];
	live: Race[];
	completed: Race[];
};

type RaceResult = {
	position: number;
	racerId: string;
	racerName: string;
	prizeMoney?: number;
	className?: string;
	classPosition?: number;
};

export type RacePresentation = {
	race: Race;
	formatLabel: string;
	trackName: string;
	trackCharacteristics: ReturnType<typeof presentTrackCharacteristics> | undefined;
	participants: Racer[];
	participantCount: number;
	winnerName: string | undefined;
	prizeStructure: { position: number; amount: number }[];
	results: RaceResult[];
};

export function raceFormatLabel(format: Race['raceFormat']): string {
	return {
		league_race: 'League Race',
		grand_prix: 'Grand Prix',
		exhibition: 'Exhibition Race',
		legends_exhibition: 'Legends Exhibition'
	}[format?.type ?? 'league_race'];
}

const titleCase = (value: string) =>
	value
		.split('-')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');

export function presentTrackCharacteristics(track: RaceTrackType) {
	const characteristics = getTrackCharacteristics(track);
	return {
		...characteristics,
		surfaceLabel: titleCase(characteristics.surface),
		hazardLabels: characteristics.hazards.map((hazard) => titleCase(hazard.type)),
		formatLabels: characteristics.compatibleFormats.map(titleCase),
		corneringDemandPercent: Math.round(characteristics.corneringDemand * 100),
		speedBiasPercent: Math.round(characteristics.speedBias * 100),
		riskPercent: Math.round(characteristics.risk * 100)
	};
}

function timestamp(value: Date | string): number {
	const result = new Date(value).getTime();
	return Number.isFinite(result) ? result : 0;
}

export function classifyRaces(races: Race[]): RaceDiscoveryGroups {
	const groups: RaceDiscoveryGroups = { upcoming: [], live: [], completed: [] };
	for (const race of races) {
		if (race.status === 'running') groups.live.push(race);
		else if (race.status === 'pending' || race.status === 'countdown') groups.upcoming.push(race);
		else groups.completed.push(race);
	}
	groups.upcoming.sort((left, right) => timestamp(left.startTime) - timestamp(right.startTime));
	groups.live.sort((left, right) => timestamp(left.startTime) - timestamp(right.startTime));
	groups.completed.sort((left, right) => timestamp(right.startTime) - timestamp(left.startTime));
	return groups;
}

export function presentRace(
	race: Race,
	racers: Racer[],
	tracks: RaceTrackType[]
): RacePresentation {
	const racerById = new Map(racers.map((racer) => [racer.id, racer]));
	const finishingOrder = Array.isArray(race.finishingOrder) ? race.finishingOrder : [];
	const participantIds =
		finishingOrder.length > 0
			? finishingOrder
			: racers
					.filter((racer) => racer.race === race.id)
					.flatMap((racer) => (racer.id ? [racer.id] : []));
	const participants = participantIds.flatMap((id) => {
		const racer = racerById.get(id);
		return racer ? [racer] : [];
	});
	const prizeByRacer = new Map(
		(race.awardedPrizes ?? []).map((prize) => [prize.racerId, prize.amount])
	);
	const classResultByRacer = new Map(
		(race.classResults ?? []).map((result) => [result.racerId, result])
	);
	const track = tracks.find((candidate) => candidate.id === race.racetrack);
	return {
		race,
		formatLabel: raceFormatLabel(race.raceFormat),
		trackName: track?.name ?? 'Unknown track',
		trackCharacteristics: track ? presentTrackCharacteristics(track) : undefined,
		participants,
		participantCount: participants.length,
		winnerName: race.winner ? (racerById.get(race.winner)?.name ?? 'Unknown racer') : undefined,
		prizeStructure: (race.prizeCurve ?? []).map((amount, index) => ({
			position: index + 1,
			amount
		})),
		results: finishingOrder.map((racerId, index) => {
			const classResult = classResultByRacer.get(racerId);
			return {
				position: index + 1,
				racerId,
				racerName: racerById.get(racerId)?.name ?? 'Unknown racer',
				prizeMoney: prizeByRacer.get(racerId),
				...(classResult
					? { className: classResult.className, classPosition: classResult.classPosition }
					: {})
			};
		})
	};
}

export function formatRaceSchedule(value: Date | string, now = new Date()): string {
	const start = new Date(value);
	if (!Number.isFinite(start.getTime())) return 'Time TBC';
	const exact = `${start.toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'UTC'
	})} UTC`;
	const remainingSeconds = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / 1_000));
	if (remainingSeconds === 0) return exact;
	const days = Math.floor(remainingSeconds / 86_400);
	const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
	const minutes = Math.floor((remainingSeconds % 3_600) / 60);
	const seconds = remainingSeconds % 60;
	const countdown = [
		days && `${days}d`,
		hours && `${hours}h`,
		minutes && `${minutes}m`,
		`${seconds}s`
	]
		.filter(Boolean)
		.slice(0, 2)
		.join(' ');
	return `${exact} · Starts in ${countdown}`;
}

export function raceStatusLabel(status: Race['status']): string {
	return {
		pending: 'Scheduled',
		countdown: 'Starting soon',
		running: 'Live',
		finished: 'Finished',
		settled: 'Official result',
		cancelled: 'Cancelled'
	}[status];
}
