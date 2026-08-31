import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { moduleRunnerTransform } from 'vite';
import {
	ESModulesEvaluator,
	ssrDynamicImportKey,
	ssrExportAllKey,
	ssrExportNameKey,
	ssrImportKey,
	ssrImportMetaKey,
	ssrModuleExportsKey
} from 'vite/module-runner';
import type { ModuleRunnerContext } from 'vite/module-runner';
import { transformPocketBaseCommonJs } from '../vite-plugins/pocketbaseCommonJs';

test('exposes the PocketBase settlement rules to Vite SSR', async () => {
	const source = await readFile('pocketbase/pb_hooks/raceSettlement.cjs', 'utf8');
	const esm = transformPocketBaseCommonJs(source);
	const transformed = await moduleRunnerTransform(
		esm,
		null,
		'/pocketbase/pb_hooks/raceSettlement.cjs',
		source
	);
	const exports: Record<string, unknown> = {};
	const previousModule = Object.getOwnPropertyDescriptor(globalThis, 'module');
	assert.ok(transformed);

	Reflect.deleteProperty(globalThis, 'module');
	try {
		await new ESModulesEvaluator().runInlinedModule(
			{
				[ssrModuleExportsKey]: exports,
				[ssrImportMetaKey]: {},
				[ssrImportKey]: async () => ({}),
				[ssrDynamicImportKey]: async () => ({}),
				[ssrExportAllKey]: () => {},
				[ssrExportNameKey]: (name: string, getter: () => unknown) => {
					Object.defineProperty(exports, name, { enumerable: true, get: getter });
				}
			} as unknown as ModuleRunnerContext,
			transformed.code
		);
	} finally {
		if (previousModule) Object.defineProperty(globalThis, 'module', previousModule);
	}

	assert.equal(
		typeof (exports.default as { buildRaceSettlement?: unknown })?.buildRaceSettlement,
		'function'
	);
});
