import { startUp } from '$lib/server/gameLoop';
import type { ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	startUp();
};
