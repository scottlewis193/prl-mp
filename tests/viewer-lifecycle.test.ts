import assert from 'node:assert/strict';
import test from 'node:test';

import { createViewerLifecycle, createViewerLifecycleManager } from '../src/lib/viewerLifecycle';

test('disposing a viewer removes listeners, ticker callbacks, assets, and renderer resources', async () => {
	const calls: string[] = [];
	const listenerTarget = {
		addEventListener: (type: string) => calls.push(`listen:${type}`),
		removeEventListener: (type: string) => calls.push(`unlisten:${type}`)
	};
	const ticker = {
		add: () => calls.push('ticker:add'),
		remove: () => calls.push('ticker:remove')
	};
	const callback = () => undefined;
	const lifecycle = createViewerLifecycle(() => undefined);

	lifecycle.listen(listenerTarget, 'mousemove', callback);
	lifecycle.tick(ticker, callback);
	lifecycle.asset('/track.png', async (source) => calls.push(`asset:unload:${source}`));
	lifecycle.renderer(() => calls.push('renderer:destroy'));

	await lifecycle.dispose();

	assert.deepEqual(calls, [
		'listen:mousemove',
		'ticker:add',
		'ticker:remove',
		'unlisten:mousemove',
		'renderer:destroy',
		'asset:unload:/track.png'
	]);
});

test('viewer cleanup is idempotent and immediately disposes late resources', async () => {
	let destroys = 0;
	const lifecycle = createViewerLifecycle();

	lifecycle.renderer(() => destroys++);
	await lifecycle.dispose();
	await lifecycle.dispose();
	lifecycle.renderer(() => destroys++);

	assert.equal(destroys, 2);
});

test('a shared asset is unloaded only once', async () => {
	let unloads = 0;
	const lifecycle = createViewerLifecycle();

	lifecycle.asset('/shared.png', () => unloads++);
	lifecycle.asset('/shared.png', () => unloads++);
	await lifecycle.dispose();

	assert.equal(unloads, 1);
});

test('cleanup continues when one resource fails to dispose', async () => {
	const calls: string[] = [];
	const lifecycle = createViewerLifecycle(() => undefined);

	lifecycle.renderer(() => {
		calls.push('renderer:failed');
		throw new Error('renderer cleanup failed');
	});
	lifecycle.asset('/track.png', () => calls.push('asset:unloaded'));

	await lifecycle.dispose();

	assert.deepEqual(calls, ['renderer:failed', 'asset:unloaded']);
});

test('leaving while a replacement lifecycle starts disposes the replacement', async () => {
	let releasePrevious!: () => void;
	const previousDisposal = new Promise<void>((resolve) => {
		releasePrevious = resolve;
	});
	const manager = createViewerLifecycleManager(() => undefined);
	manager.current.renderer(() => previousDisposal);

	const replacementPromise = manager.replace();
	const replacement = manager.current;
	const leavePromise = manager.dispose();
	assert.equal(replacement.disposed, true);

	releasePrevious();
	assert.equal(await replacementPromise, replacement);
	await leavePromise;
});
