import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

async function serverComponent(name: string) {
	const source = await readFile(
		new URL(`../src/lib/components/${name}.svelte`, import.meta.url),
		'utf8'
	);
	const { js } = compile(source, {
		filename: `src/lib/components/${name}.svelte`,
		generate: 'server'
	});
	const executableModule = js.code
		.replace(
			"'svelte/internal/server'",
			JSON.stringify(
				new URL('../node_modules/svelte/src/internal/server/index.js', import.meta.url).href
			)
		)
		.replace(
			"'$lib/settingsPreferences'",
			JSON.stringify(new URL('../src/lib/settingsPreferences.ts', import.meta.url).href)
		)
		.replace(
			"'$lib/subscribe'",
			JSON.stringify(new URL('../src/lib/subscribe.ts', import.meta.url).href)
		);
	const directory = await mkdtemp(join(tmpdir(), 'settings-component-'));
	const modulePath = join(directory, `${name}.js`);
	await writeFile(modulePath, executableModule);
	const component = (await import(pathToFileURL(modulePath).href)).default;
	return { component, cleanup: () => rm(directory, { recursive: true }) };
}

test('settings form shows every supported persisted preference', async () => {
	const { component, cleanup } = await serverComponent('SettingsPreferences');
	const { body } = render(component, {
		props: {
			user: {
				name: 'Misty',
				email: 'misty@example.com',
				options: {
					raceViewer: { cameraMode: 'follow', leaderboardMode: 'leader' },
					theme: 'dark',
					accessibility: { reducedMotion: true, highContrast: true }
				}
			}
		}
	});

	for (const name of [
		'name="cameraMode"',
		'name="leaderboardMode"',
		'name="theme"',
		'name="reducedMotion"',
		'name="highContrast"'
	]) {
		assert.match(body, new RegExp(name));
	}
	assert.match(body, /value="follow" selected/);
	assert.match(body, /value="leader" selected/);
	assert.match(body, /value="dark" selected/);
	assert.match(body, /name="reducedMotion"[^>]*checked/);
	assert.match(body, /name="highContrast"[^>]*checked/);
	await cleanup();
});

test('notification consent renders missing configuration as disabled guidance', async () => {
	const { component, cleanup } = await serverComponent('NotificationConsent');
	const { body } = render(component, {
		props: {
			state: {
				status: 'unavailable',
				message: 'Push notifications are not configured on this server.'
			}
		}
	});

	assert.match(body, /Push notifications are not configured on this server/);
	assert.match(body, /<button[^>]*disabled[^>]*>Enable notifications/);
	assert.doesNotMatch(body, /alert-error/);
	await cleanup();
});

test('notification consent exposes enrollment only as a player button action', async () => {
	const { component, cleanup } = await serverComponent('NotificationConsent');
	const { body } = render(component, { props: { state: { status: 'inactive' } } });

	assert.match(body, /<button[^>]*>Enable notifications/);
	assert.match(body, /Permission is requested only when you\s+select Enable notifications/);
	await cleanup();
});
