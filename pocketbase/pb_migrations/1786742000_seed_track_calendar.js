/// <reference path="../pb_data/types.d.ts" />

const calendarTracks = [
	{
		id: 'prlalpinetrack1',
		name: 'Alpine Switchback',
		filename: 'alpineSwitchback.json',
		width: 32,
		surface: 'ice',
		hazards: [
			{ type: 'black-ice', severity: 0.7, checkpointIndex: 2 },
			{ type: 'snow-drift', severity: 0.45, checkpointIndex: 4 }
		],
		corneringDemand: 0.85,
		speedBias: -0.45,
		risk: 0.65
	},
	{
		id: 'prlforesttrack1',
		name: 'Forest Chicane',
		filename: 'forestChicane.json',
		width: 40,
		surface: 'dirt',
		hazards: [{ type: 'mud', severity: 0.4, checkpointIndex: 3 }],
		corneringDemand: 0.75,
		speedBias: -0.2,
		risk: 0.35
	},
	{
		id: 'prlcanyontrack1',
		name: 'Red Canyon Ring',
		filename: 'redCanyonRing.json',
		width: 56,
		surface: 'asphalt',
		hazards: [{ type: 'dust-cloud', severity: 0.3, checkpointIndex: 5 }],
		corneringDemand: 0.3,
		speedBias: 0.65,
		risk: 0.25
	}
];

function readCalendarTrack(filename) {
	return JSON.parse(
		toString($os.readFile($filepath.join($os.getwd(), 'src', 'lib', 'tracks', filename)))
	);
}

function calendarTrackGeometry(trackData) {
	const checkpointLayer = trackData.layers.find(
		(layer) => layer.name && layer.name.toLowerCase() === 'checkpoints'
	);
	const checkpoints = (checkpointLayer?.objects || [])
		.map((checkpoint) => ({
			index: Number(checkpoint.name),
			x: checkpoint.x,
			y: checkpoint.y
		}))
		.sort((left, right) => left.index - right.index);
	let length = 0;
	for (let index = 1; index < checkpoints.length; index++) {
		length += Math.hypot(
			checkpoints[index].x - checkpoints[index - 1].x,
			checkpoints[index].y - checkpoints[index - 1].y
		);
	}
	return {
		checkpoints,
		length,
		maxSize: {
			x: trackData.width * trackData.tilewidth,
			y: trackData.height * trackData.tileheight
		}
	};
}

migrate(
	(app) => {
		const racetracks = app.findCollectionByNameOrId('racetracks');
		for (const definition of calendarTracks) {
			const data = readCalendarTrack(definition.filename);
			const geometry = calendarTrackGeometry(data);
			const track = new Record(racetracks);
			track.set('id', definition.id);
			track.set('name', definition.name);
			track.set('checkpoints', geometry.checkpoints);
			track.set('data', data);
			track.set('length', geometry.length);
			track.set('totalLength', geometry.length);
			track.set('width', definition.width);
			track.set('maxSize', geometry.maxSize);
			track.set('surface', definition.surface);
			track.set('hazards', definition.hazards);
			track.set('corneringDemand', definition.corneringDemand);
			track.set('speedBias', definition.speedBias);
			track.set('risk', definition.risk);
			track.set('compatibleFormats', ['circuit']);
			app.save(track);
		}
	},
	(app) => {
		for (const definition of calendarTracks) {
			try {
				app.delete(app.findRecordById('racetracks', definition.id));
			} catch {}
		}
	}
);
