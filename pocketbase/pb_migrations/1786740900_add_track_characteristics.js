/// <reference path="../pb_data/types.d.ts" />

const coastalTrackId = 'prlcoasttrack01';
// Immutable migration data is intentionally self-contained instead of importing hook runtime code.
const migratedRaceFormat = 'circuit';

function readTrackData(filename) {
	return JSON.parse(
		toString($os.readFile($filepath.join($os.getwd(), 'src', 'lib', 'tracks', filename)))
	);
}

function trackGeometry(trackData) {
	const checkpoints = [];
	for (const layer of trackData.layers) {
		if (layer.name && layer.name.toLowerCase() === 'checkpoints') {
			for (const checkpoint of layer.objects || []) {
				checkpoints.push({ index: Number(checkpoint.name), x: checkpoint.x, y: checkpoint.y });
			}
		}
	}
	checkpoints.sort((left, right) => left.index - right.index);
	let length = 0;
	for (let index = 1; index < checkpoints.length; index++) {
		const previous = checkpoints[index - 1];
		const current = checkpoints[index];
		length += Math.hypot(current.x - previous.x, current.y - previous.y);
	}
	return {
		checkpoints,
		length,
		maxSize: {
			x: (trackData.width || 0) * trackData.tilewidth,
			y: (trackData.height || 0) * trackData.tileheight
		}
	};
}

migrate(
	(app) => {
		const racetracks = app.findCollectionByNameOrId('racetracks');
		racetracks.fields.add(
			new NumberField({ name: 'length', min: 0 }),
			new SelectField({
				name: 'surface',
				maxSelect: 1,
				values: ['asphalt', 'dirt', 'grass', 'sand', 'ice']
			}),
			new JSONField({ name: 'hazards', maxSize: 100000 }),
			new NumberField({ name: 'corneringDemand', min: 0, max: 1 }),
			new NumberField({ name: 'speedBias', min: -1, max: 1 }),
			new NumberField({ name: 'risk', min: 0, max: 1 }),
			new JSONField({ name: 'compatibleFormats', maxSize: 20000 })
		);
		app.save(racetracks);

		const races = app.findCollectionByNameOrId('races');
		races.fields.add(
			new SelectField({ name: 'format', maxSelect: 1, values: [migratedRaceFormat] })
		);
		app.save(races);

		const originalTrack = app.findRecordById('racetracks', '175hl67e5pvjjib');
		originalTrack.set('length', originalTrack.getFloat('totalLength'));
		originalTrack.set('surface', 'grass');
		originalTrack.set('hazards', [{ type: 'tight-turn', severity: 0.25, checkpointIndex: 4 }]);
		originalTrack.set('corneringDemand', 0.35);
		originalTrack.set('speedBias', 0.2);
		originalTrack.set('risk', 0.15);
		originalTrack.set('compatibleFormats', [migratedRaceFormat]);
		app.save(originalTrack);

		for (const race of app.findAllRecords('races')) {
			race.set('format', migratedRaceFormat);
			app.save(race);
		}

		const coastalData = readTrackData('coastalLoop.json');
		const coastalGeometry = trackGeometry(coastalData);
		const coastalTrack = new Record(racetracks);
		coastalTrack.set('id', coastalTrackId);
		coastalTrack.set('name', 'Coastal Loop');
		coastalTrack.set('checkpoints', coastalGeometry.checkpoints);
		coastalTrack.set('data', coastalData);
		coastalTrack.set('length', coastalGeometry.length);
		coastalTrack.set('totalLength', coastalGeometry.length);
		coastalTrack.set('width', 48);
		coastalTrack.set('maxSize', coastalGeometry.maxSize);
		coastalTrack.set('surface', 'sand');
		coastalTrack.set('hazards', [
			{ type: 'crosswind', severity: 0.6, checkpointIndex: 2 },
			{ type: 'soft-verge', severity: 0.35, checkpointIndex: 3 }
		]);
		coastalTrack.set('corneringDemand', 0.7);
		coastalTrack.set('speedBias', -0.25);
		coastalTrack.set('risk', 0.4);
		coastalTrack.set('compatibleFormats', [migratedRaceFormat]);
		app.save(coastalTrack);
	},
	(app) => {
		try {
			app.delete(app.findRecordById('racetracks', coastalTrackId));
		} catch {}

		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('format');
		app.save(races);

		const racetracks = app.findCollectionByNameOrId('racetracks');
		for (const field of [
			'length',
			'surface',
			'hazards',
			'corneringDemand',
			'speedBias',
			'risk',
			'compatibleFormats'
		]) {
			racetracks.fields.removeByName(field);
		}
		app.save(racetracks);
	}
);
