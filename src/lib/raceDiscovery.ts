import type { Race, Racer, RaceTrackType } from './types';

export type RaceDiscoveryGroups = {
	upcoming: Race[];
	live: Race[];
	completed: Race[];
};

type RaceResult = {
	position: number;
	racerId: string;
	racerName: string;
};

export type RacePresentation = {
	race: Race;
	trackName: string;
	participants: Racer[];
	participantCount: number;
	winnerName: string | undefined;
	results: RaceResult[];
};

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
	const participantIds =
		race.finishingOrder.length > 0
			? race.finishingOrder
			: racers
					.filter((racer) => racer.race === race.id)
					.flatMap((racer) => (racer.id ? [racer.id] : []));
	const participants = participantIds.flatMap((id) => {
		const racer = racerById.get(id);
		return racer ? [racer] : [];
	});
	return {
		race,
		trackName: tracks.find((track) => track.id === race.racetrack)?.name ?? 'Unknown track',
		participants,
		participantCount: participants.length,
		winnerName: race.winner ? (racerById.get(race.winner)?.name ?? 'Unknown racer') : undefined,
		results: race.finishingOrder.map((racerId, index) => ({
			position: index + 1,
			racerId,
			racerName: racerById.get(racerId)?.name ?? 'Unknown racer'
		}))
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
