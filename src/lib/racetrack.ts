import * as defaultTrackData from './tracks/defaultTrack.json';

export interface RaceTrack {
	id: string;
	name: string;
	checkpoints: { index: number; x: number; y: number }[];
	data: any;
	tileset: string;
	totalLength: number;
	width: number;
	maxSize: { x: number; y: number };
}

const defaultCheckpoints = {
	0: { x: 800, y: 100 },
	1: { x: 1180, y: 100 },
	2: { x: 1180, y: 620 },
	3: { x: 100, y: 620 },
	4: { x: 100, y: 100 },
	5: { x: 100, y: 100 },
	6: { x: 800, y: 100 }
};

export const defaultRaceTrack: RaceTrack = {
	id: '0',
	name: 'Default Track',
	checkpoints: getCheckpoints(),
	tileset: '/pokemon_tileset.png',
	totalLength: getTotalTrackLength(Object.values(defaultCheckpoints)),
	width: 32,
	maxSize: {
		x: Math.max(...Object.values(defaultCheckpoints).map((cp) => cp.x)) + 100,
		y: Math.max(...Object.values(defaultCheckpoints).map((cp) => cp.y)) + 100
	},
	data: defaultTrackData
};

function getTotalTrackLength(checkpoints: { x: number; y: number }[]) {
	let total = 0;
	for (let i = 0; i < checkpoints.length - 1; i++) {
		const curr = checkpoints[i];
		const next = checkpoints[i + 1];
		total += Math.hypot(next.x - curr.x, next.y - curr.y);
	}
	return total;
}

function getCheckpoints() {
	const checkpoints: { index: number; x: number; y: number }[] = [];
	for (const layer of defaultTrackData.layers) {
		//get checkpoints
		if (layer.name.toLowerCase() == 'checkpoints') {
			for (const object of layer?.objects || []) {
				checkpoints.push({ index: Number(object.name), x: object.x, y: object.y });
			}
			checkpoints.sort((a, b) => a.index - b.index);
			continue;
		}
	}
	return checkpoints;
}
