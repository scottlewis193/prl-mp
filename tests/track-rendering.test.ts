import assert from 'node:assert/strict';
import test from 'node:test';

import { createTrackRenderPlan, resolveTrackTilesetUrl } from '../src/lib/trackRendering';
import type { RaceTrackType } from '../src/lib/types';

function track(data: RaceTrackType['data']): RaceTrackType {
	return {
		id: 'track-one',
		name: 'Test Track',
		checkpoints: [],
		data,
		tileset: '',
		totalLength: 0,
		width: 0,
		maxSize: { x: 0, y: 0 }
	};
}

test('creates a render plan from a finite track configuration', () => {
	const plan = createTrackRenderPlan(
		track({
			width: 2,
			height: 1,
			tilewidth: 24,
			tileheight: 12,
			infinite: false,
			tilesets: [
				{
					firstgid: 1,
					image: '/tracks/desert.png',
					imagewidth: 72,
					tilewidth: 24,
					tileheight: 12,
					columns: 3,
					margin: 0,
					spacing: 0
				}
			],
			layers: [
				{ name: 'Ground', type: 'tilelayer', width: 2, height: 1, data: [1, 3] },
				{
					name: 'Checkpoints',
					type: 'objectgroup',
					objects: [
						{ name: '1', x: 48, y: 12 },
						{ name: '0', x: 0, y: 12 }
					]
				}
			]
		})
	);

	assert.deepEqual(plan.size, { width: 48, height: 12 });
	assert.deepEqual(plan.checkpoints, [
		{ index: 0, x: 0, y: 12 },
		{ index: 1, x: 48, y: 12 }
	]);
	assert.equal(plan.tilesets[0].url, '/tracks/desert.png');
	assert.deepEqual(plan.layers[0].tiles, [
		{ x: 0, y: 0, tilesetIndex: 0, frame: { x: 0, y: 0, width: 24, height: 12 } },
		{ x: 24, y: 0, tilesetIndex: 0, frame: { x: 48, y: 0, width: 24, height: 12 } }
	]);
});

test('creates a render plan from an infinite track with multiple configured tilesets', () => {
	const configuredTrack = track({
		tilewidth: 32,
		tileheight: 24,
		infinite: true,
		tilesets: [
			{
				firstgid: 1,
				image: 'ground.png',
				imagewidth: 64,
				tilewidth: 32,
				tileheight: 24,
				columns: 2,
				margin: 0,
				spacing: 0
			},
			{
				firstgid: 10,
				image: 'decor.png',
				imagewidth: 36,
				tilewidth: 16,
				tileheight: 16,
				columns: 2,
				margin: 1,
				spacing: 2
			}
		],
		layers: [
			{
				name: 'Decor',
				type: 'tilelayer',
				chunks: [{ x: -1, y: 2, width: 2, height: 1, data: [10, 11] }]
			},
			{
				name: 'checkpoints',
				type: 'objectgroup',
				objects: [
					{ name: '0', x: -32, y: 48 },
					{ name: '1', x: 32, y: 48 }
				]
			}
		]
	});

	const plan = createTrackRenderPlan(configuredTrack, (_track, tileset, index) =>
		index === 1 ? '/api/files/decor.webp' : tileset.image
	);

	assert.equal(plan.tilesets[1].url, '/api/files/decor.webp');
	assert.deepEqual(plan.layers[0].tiles, [
		{ x: -32, y: 48, tilesetIndex: 1, frame: { x: 1, y: 1, width: 16, height: 16 } },
		{ x: 0, y: 48, tilesetIndex: 1, frame: { x: 19, y: 1, width: 16, height: 16 } }
	]);
	assert.deepEqual(plan.size, { width: 64, height: 24 });
});

test('rejects a track without renderable tilesets', () => {
	assert.throws(
		() => createTrackRenderPlan(track({ tilewidth: 16, tileheight: 16, tilesets: [], layers: [] })),
		/does not configure a tileset/i
	);
});

test('uses selected track checkpoints when the Tiled map has no checkpoint layer', () => {
	const configuredTrack = track({
		width: 1,
		height: 1,
		tilewidth: 16,
		tileheight: 16,
		tilesets: [{ firstgid: 1, image: '/track.png', tilewidth: 16, tileheight: 16, columns: 1 }],
		layers: [{ name: 'Ground', type: 'tilelayer', width: 1, height: 1, data: [1] }]
	});
	configuredTrack.checkpoints = [
		{ index: 0, x: 8, y: 8 },
		{ index: 1, x: 24, y: 8 }
	];

	assert.deepEqual(createTrackRenderPlan(configuredTrack).checkpoints, configuredTrack.checkpoints);
});

test('preserves configured Tiled tile flips and diagonal rotation', () => {
	const plan = createTrackRenderPlan(
		track({
			width: 1,
			height: 1,
			tilewidth: 16,
			tileheight: 16,
			tilesets: [{ firstgid: 1, image: '/track.png', tilewidth: 16, tileheight: 16, columns: 1 }],
			layers: [
				{
					name: 'Ground',
					type: 'tilelayer',
					width: 1,
					height: 1,
					data: [0xa0000001]
				}
			]
		})
	);

	assert.deepEqual(plan.layers[0].tiles[0].transform, { a: 0, b: 1, c: -1, d: 0 });
});

test('renders tile layers nested in configured Tiled groups', () => {
	const plan = createTrackRenderPlan(
		track({
			width: 2,
			height: 1,
			tilewidth: 16,
			tileheight: 16,
			tilesets: [{ firstgid: 1, image: '/track.png', tilewidth: 16, tileheight: 16, columns: 1 }],
			layers: [
				{
					name: 'Scenery',
					type: 'group',
					offsetx: 4,
					opacity: 0.5,
					layers: [
						{
							name: 'Upper',
							type: 'tilelayer',
							x: 1,
							width: 1,
							height: 1,
							opacity: 0.5,
							data: [1]
						}
					]
				}
			]
		})
	);

	assert.equal(plan.layers[0].name, 'Scenery / Upper');
	assert.equal(plan.layers[0].opacity, 0.25);
	assert.equal(plan.layers[0].tiles[0].x, 20);
});

test('resolves an uploaded primary tileset and additional configured tileset URLs', () => {
	const configuredTrack = track({});
	configuredTrack.tileset = 'uploaded.webp';

	assert.equal(
		resolveTrackTilesetUrl(
			configuredTrack,
			{ firstgid: 1, image: 'primary.png', tilewidth: 16, tileheight: 16 },
			0,
			(_track, filename) => `/api/files/${filename}`
		),
		'/api/files/uploaded.webp'
	);
	assert.equal(
		resolveTrackTilesetUrl(
			configuredTrack,
			{ firstgid: 10, image: '/tracks/decor.webp', tilewidth: 16, tileheight: 16 },
			1,
			() => '/unused'
		),
		'/tracks/decor.webp'
	);
});
