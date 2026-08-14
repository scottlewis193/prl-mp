import type { RaceTrackType } from '$lib/types';

const TILED_FLIP_HORIZONTAL = 0x80000000;
const TILED_FLIP_VERTICAL = 0x40000000;
const TILED_FLIP_DIAGONAL = 0x20000000;
const TILED_GID_MASK = 0x0fffffff;

export type TiledTileset = {
	firstgid: number;
	image?: string;
	imagewidth?: number;
	tilewidth: number;
	tileheight: number;
	columns?: number;
	margin?: number;
	spacing?: number;
	source?: string;
};

type TiledChunk = {
	x: number;
	y: number;
	width: number;
	height: number;
	data: number[];
};

type TiledLayer = {
	name?: string;
	type: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	data?: number[];
	chunks?: TiledChunk[];
	objects?: { name?: string; x: number; y: number }[];
	layers?: TiledLayer[];
	visible?: boolean;
	opacity?: number;
	offsetx?: number;
	offsety?: number;
};

type TiledMap = {
	width?: number;
	height?: number;
	tilewidth: number;
	tileheight: number;
	tilesets: TiledTileset[];
	layers: TiledLayer[];
};

export type TrackFrame = { x: number; y: number; width: number; height: number };

export type TrackTile = {
	x: number;
	y: number;
	tilesetIndex: number;
	frame: TrackFrame;
	transform?: { a: number; b: number; c: number; d: number };
};

export type TrackRenderPlan = {
	size: { width: number; height: number };
	checkpoints: { index: number; x: number; y: number }[];
	tilesets: (TiledTileset & { url: string })[];
	layers: { name: string; opacity: number; tiles: TrackTile[] }[];
	tileCount: number;
};

export type TilesetUrlResolver = (
	track: RaceTrackType,
	tileset: TiledTileset,
	index: number
) => string | undefined;

export function resolveTrackTilesetUrl(
	track: RaceTrackType,
	tileset: TiledTileset,
	index: number,
	getUploadedFileUrl: (track: RaceTrackType, filename: string) => string
): string | undefined {
	if (index === 0 && track.tileset) return getUploadedFileUrl(track, track.tileset);
	if (!tileset.image) return undefined;
	if (/^(?:https?:|data:|blob:|\/)/.test(tileset.image)) return tileset.image;
	const filename = tileset.image.split(/[\\/]/).pop();
	return filename ? `/${filename}` : undefined;
}

export function createTrackRenderPlan(
	track: RaceTrackType,
	resolveTilesetUrl: TilesetUrlResolver = (_track, tileset) => tileset.image
): TrackRenderPlan {
	const map = track.data as TiledMap;
	if (!map || !Array.isArray(map.layers)) {
		throw new Error(`Track “${track.name}” has no Tiled layer configuration.`);
	}
	if (!(map.tilewidth > 0) || !(map.tileheight > 0)) {
		throw new Error(`Track “${track.name}” has invalid tile dimensions.`);
	}
	if (!Array.isArray(map.tilesets) || map.tilesets.length === 0) {
		throw new Error(`Track “${track.name}” does not configure a tileset.`);
	}

	const tilesets = [...map.tilesets]
		.sort((a, b) => a.firstgid - b.firstgid)
		.map((tileset, index) => {
			if (tileset.source) {
				throw new Error(`Track “${track.name}” uses an unsupported external TSX tileset.`);
			}
			const url = resolveTilesetUrl(track, tileset, index);
			if (!url) {
				throw new Error(`Track “${track.name}” tileset ${index + 1} has no loadable image.`);
			}
			return { ...tileset, url };
		});

	const checkpoints: TrackRenderPlan['checkpoints'] = [];
	const layers: TrackRenderPlan['layers'] = [];
	let minPixelX = Number.POSITIVE_INFINITY;
	let minPixelY = Number.POSITIVE_INFINITY;
	let maxPixelX = Number.NEGATIVE_INFINITY;
	let maxPixelY = Number.NEGATIVE_INFINITY;

	function visitLayer(
		layer: TiledLayer,
		parent: { tileX: number; tileY: number; pixelX: number; pixelY: number; opacity: number },
		path: string[]
	) {
		if (layer.visible === false) return;
		const position = {
			tileX: parent.tileX + (layer.x ?? 0),
			tileY: parent.tileY + (layer.y ?? 0),
			pixelX: parent.pixelX + (layer.offsetx ?? 0),
			pixelY: parent.pixelY + (layer.offsety ?? 0),
			opacity: parent.opacity * (layer.opacity ?? 1)
		};
		const layerPath = layer.name ? [...path, layer.name] : path;
		if (layer.type === 'group') {
			for (const child of layer.layers ?? []) visitLayer(child, position, layerPath);
			return;
		}
		if (layer.name?.toLowerCase() === 'checkpoints') {
			for (const [index, object] of (layer.objects ?? []).entries()) {
				checkpoints.push({
					index: Number(object.name ?? index),
					x: object.x + position.tileX * map.tilewidth + position.pixelX,
					y: object.y + position.tileY * map.tileheight + position.pixelY
				});
			}
			return;
		}
		if (layer.type !== 'tilelayer') return;

		const tiles: TrackTile[] = [];
		const chunks = layer.chunks ?? finiteLayerChunk(layer);
		for (const chunk of chunks) {
			for (let dataIndex = 0; dataIndex < chunk.data.length; dataIndex++) {
				const rawGid = chunk.data[dataIndex] >>> 0;
				const gid = rawGid & TILED_GID_MASK;
				if (gid === 0) continue;
				const tilesetIndex = findTilesetIndex(tilesets, gid);
				if (tilesetIndex < 0) {
					throw new Error(`Track “${track.name}” references unknown tile GID ${gid}.`);
				}
				const tileset = tilesets[tilesetIndex];
				const tileIndex = gid - tileset.firstgid;
				const columns =
					tileset.columns ??
					Math.floor(
						((tileset.imagewidth ?? 0) - 2 * (tileset.margin ?? 0) + (tileset.spacing ?? 0)) /
							(tileset.tilewidth + (tileset.spacing ?? 0))
					);
				if (!(columns > 0)) {
					throw new Error(`Track “${track.name}” tileset ${tilesetIndex + 1} has no columns.`);
				}

				const tileGridX = chunk.x + (dataIndex % chunk.width) + position.tileX;
				const tileGridY = chunk.y + Math.floor(dataIndex / chunk.width) + position.tileY;
				const tilePixelX = tileGridX * map.tilewidth + position.pixelX;
				const tilePixelY = tileGridY * map.tileheight + position.pixelY;
				const margin = tileset.margin ?? 0;
				const spacing = tileset.spacing ?? 0;
				const transform = getTileTransform(rawGid);
				tiles.push({
					x: tilePixelX,
					y: tilePixelY,
					tilesetIndex,
					frame: {
						x: margin + (tileIndex % columns) * (tileset.tilewidth + spacing),
						y: margin + Math.floor(tileIndex / columns) * (tileset.tileheight + spacing),
						width: tileset.tilewidth,
						height: tileset.tileheight
					},
					...(transform ? { transform } : {})
				});
				minPixelX = Math.min(minPixelX, tilePixelX);
				minPixelY = Math.min(minPixelY, tilePixelY);
				maxPixelX = Math.max(maxPixelX, tilePixelX + map.tilewidth);
				maxPixelY = Math.max(maxPixelY, tilePixelY + map.tileheight);
			}
		}
		layers.push({
			name: layerPath.join(' / ') || 'Tile Layer',
			opacity: position.opacity,
			tiles
		});
	}

	for (const layer of map.layers) {
		visitLayer(layer, { tileX: 0, tileY: 0, pixelX: 0, pixelY: 0, opacity: 1 }, []);
	}

	checkpoints.sort((a, b) => a.index - b.index);
	if (checkpoints.length === 0) {
		checkpoints.push(...track.checkpoints.map((checkpoint) => ({ ...checkpoint })));
		checkpoints.sort((a, b) => a.index - b.index);
	}
	const configuredWidth = (map.width ?? 0) * map.tilewidth;
	const configuredHeight = (map.height ?? 0) * map.tileheight;
	const measuredWidth = Number.isFinite(minPixelX) ? maxPixelX - minPixelX : 0;
	const measuredHeight = Number.isFinite(minPixelY) ? maxPixelY - minPixelY : 0;

	return {
		size: {
			width: Math.max(configuredWidth, measuredWidth),
			height: Math.max(configuredHeight, measuredHeight)
		},
		checkpoints,
		tilesets,
		layers,
		tileCount: layers.reduce((total, layer) => total + layer.tiles.length, 0)
	};
}

function finiteLayerChunk(layer: TiledLayer): TiledChunk[] {
	if (!layer.data || !layer.width) return [];
	return [
		{
			x: 0,
			y: 0,
			width: layer.width,
			height: layer.height ?? Math.ceil(layer.data.length / layer.width),
			data: layer.data
		}
	];
}

function findTilesetIndex(tilesets: TiledTileset[], gid: number): number {
	for (let index = tilesets.length - 1; index >= 0; index--) {
		if (gid >= tilesets[index].firstgid) return index;
	}
	return -1;
}

function getTileTransform(
	rawGid: number
): { a: number; b: number; c: number; d: number } | undefined {
	const diagonal = (rawGid & TILED_FLIP_DIAGONAL) !== 0;
	const horizontal = (rawGid & TILED_FLIP_HORIZONTAL) !== 0;
	const vertical = (rawGid & TILED_FLIP_VERTICAL) !== 0;
	if (!diagonal && !horizontal && !vertical) return undefined;

	let a = diagonal ? 0 : 1;
	let b = diagonal ? 1 : 0;
	let c = diagonal ? 1 : 0;
	let d = diagonal ? 0 : 1;
	if (horizontal) {
		if (a) a *= -1;
		if (c) c *= -1;
	}
	if (vertical) {
		if (b) b *= -1;
		if (d) d *= -1;
	}
	return { a, b, c, d };
}
