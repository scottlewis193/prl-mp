import 'dotenv/config';

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binary = resolve(projectDirectory, 'pocketbase/pocketbase');

try {
	await access(binary, constants.X_OK);
} catch {
	console.error('PocketBase is not installed. Run `npm run pb:install` first.');
	process.exit(1);
}

const args = process.argv.slice(2);
const commandArgs = args.length
	? args
	: [
			'serve',
			'--http=127.0.0.1:8090',
			`--dir=${resolve(projectDirectory, 'pocketbase/pb_data')}`,
			`--migrationsDir=${resolve(projectDirectory, 'pocketbase/pb_migrations')}`
		];

const child = spawn(binary, commandArgs, {
	cwd: projectDirectory,
	env: process.env,
	stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 1);
});
