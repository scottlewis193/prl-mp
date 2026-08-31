import { resolve } from 'node:path';

import type { Plugin } from 'vite';

const commonJsExport = /^module\.exports\s*=\s*(.+);$/m;

export function transformPocketBaseCommonJs(code: string): string {
	const transformed = code.replace(commonJsExport, 'export default $1;');
	if (transformed === code) {
		throw new Error('Expected the PocketBase module to have a CommonJS export');
	}
	return transformed;
}

export function pocketBaseRaceSettlementInterop(): Plugin {
	const settlementModule = resolve('pocketbase/pb_hooks/raceSettlement.cjs');

	return {
		name: 'pocketbase-race-settlement-interop',
		enforce: 'pre',
		transform(code, id) {
			if (id.split('?')[0] !== settlementModule) return null;

			return {
				code: transformPocketBaseCommonJs(code),
				map: null
			};
		}
	};
}
