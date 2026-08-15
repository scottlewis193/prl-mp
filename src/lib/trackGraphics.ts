import { Graphics, type Container } from 'pixi.js';
import type { TrackRenderPlan } from './trackRendering';
import type { TrackSurface } from './types';

const surfaceColors: Record<TrackSurface, number> = {
	asphalt: 0x94a3b8,
	dirt: 0xa16207,
	grass: 0x65a30d,
	sand: 0xfacc15,
	ice: 0x7dd3fc
};

export function initializeTrackGraphics(
	destination: Container,
	geometryPlan: TrackRenderPlan['geometry']
): Graphics {
	const geometry = new Graphics({ label: 'track-characteristics' });
	const [firstPoint, ...remainingPoints] = geometryPlan.centerline;
	if (firstPoint && remainingPoints.length > 0) {
		geometry.moveTo(firstPoint.x, firstPoint.y);
		for (const point of remainingPoints) geometry.lineTo(point.x, point.y);
		geometry.closePath().stroke({
			color: surfaceColors[geometryPlan.surface],
			width: Math.max(2, geometryPlan.width),
			alpha: 0.18,
			join: 'round',
			cap: 'round'
		});
	}
	for (const hazard of geometryPlan.hazards) {
		geometry
			.circle(hazard.x, hazard.y, 4 + hazard.severity * 8)
			.fill({ color: 0xef4444, alpha: 0.45 });
	}
	destination.addChild(geometry);
	return geometry;
}
