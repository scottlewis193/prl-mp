import type { Racer } from '$lib/types';

export function applyRacerUpdate(racers: Racer[], updated: Racer, now = performance.now()) {
	const index = racers.findIndex((racer) => racer.id === updated.id);

	if (index === -1) {
		racers.push(updated);
		return;
	}

	const currentX = racers[index]._displayX ?? racers[index]._targetX ?? racers[index].positioning.x;
	const currentY = racers[index]._displayY ?? racers[index]._targetY ?? racers[index].positioning.y;
	Object.assign(racers[index], updated);
	racers[index]._lastTargetX = currentX;
	racers[index]._lastTargetY = currentY;
	racers[index]._targetX = updated.positioning.x;
	racers[index]._targetY = updated.positioning.y;
	racers[index]._interpStartTime = now;
	racers[index]._interpDuration = 500;
}
