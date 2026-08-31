import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { unregisterLegacyServiceWorkers } from '../src/lib/serviceWorkerRegistration';

test('legacy service-worker registrations are removed before registering the current worker', async () => {
	const unregistered: string[] = [];
	const registration = (scriptURL: string) => ({
		active: { scriptURL },
		installing: null,
		waiting: null,
		async unregister() {
			unregistered.push(scriptURL);
			return true;
		}
	});

	await unregisterLegacyServiceWorkers({
		getRegistrations: async () => [
			registration('http://localhost/service-worker.js'),
			registration('http://localhost/sw.js'),
			registration('http://localhost/custom-sw-src.js')
		]
	});

	assert.deepEqual(unregistered, [
		'http://localhost/service-worker.js',
		'http://localhost/sw.js'
	]);
});

test('legacy cleanup tolerates browsers that cannot enumerate service workers', async () => {
	await assert.doesNotReject(
		unregisterLegacyServiceWorkers({
			getRegistrations: async () => {
				throw new DOMException('NS_ERROR_FAILURE');
			}
		})
	);
});

test('legacy generated service-worker bundles are not shipped as static assets', async () => {
	for (const filename of ['service-worker.js', 'sw.js', 'workbox-5ffe50d4.js']) {
		await assert.rejects(access(new URL(`../static/${filename}`, import.meta.url)));
	}

	const source = await readFile(new URL('../src/custom-sw-src.js', import.meta.url), 'utf8');
	assert.match(source, /precacheAndRoute/);
});

test('VitePWA is the only service-worker registration owner', async () => {
	const svelteConfig = await readFile(new URL('../svelte.config.js', import.meta.url), 'utf8');
	const viteConfig = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
	assert.match(svelteConfig, /serviceWorker\s*:\s*\{\s*register\s*:\s*false/);
	assert.match(svelteConfig, /serviceWorker\s*:\s*['"]src\/custom-sw-src\.js['"]/);
	assert.doesNotMatch(viteConfig, /devOptions\s*:\s*\{[\s\S]*?enabled\s*:\s*true/);
});
