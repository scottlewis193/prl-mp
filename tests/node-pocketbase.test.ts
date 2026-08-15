import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Node PocketBase URL building ignores a stale closed JSDOM window', () => {
	const helperUrl = new URL('./support/node-pocketbase.ts', import.meta.url).href;
	const script = `
		import { JSDOM } from 'jsdom';
		const dom = new JSDOM('', { url: 'https://stale.example.test/' });
		globalThis.window = dom.window;
		dom.window.close();
		const { NodePocketBase } = await import(${JSON.stringify(helperUrl)});
		const cases = [
			['http://127.0.0.1:8090', '', 'http://127.0.0.1:8090'],
			['http://127.0.0.1:8090/', '', 'http://127.0.0.1:8090/'],
			['http://127.0.0.1:8090', 'api/health', 'http://127.0.0.1:8090/api/health'],
			['http://127.0.0.1:8090', '/api/health', 'http://127.0.0.1:8090/api/health'],
			['http://127.0.0.1:8090/', 'api/health', 'http://127.0.0.1:8090/api/health'],
			['http://127.0.0.1:8090/', '/api/health', 'http://127.0.0.1:8090/api/health']
		];
		for (const [baseURL, path, expected] of cases) {
			const actual = new NodePocketBase(baseURL).buildURL(path);
			if (actual !== expected) throw new Error('Unexpected URL: ' + actual + ' !== ' + expected);
		}
	`;
	const result = spawnSync(process.execPath, ['--eval', script], {
		cwd: import.meta.dirname,
		encoding: 'utf8'
	});

	assert.equal(result.status, 0, result.stderr || result.stdout);
});
