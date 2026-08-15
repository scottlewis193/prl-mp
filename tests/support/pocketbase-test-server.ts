import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

export const projectDirectory = resolve(import.meta.dirname, '../..');
export const testSuperuserEmail = 'pocketbase-test-superuser@example.com';
export const testSuperuserPassword = 'pocketbase-test-superuser-password';
const execFileAsync = promisify(execFile);

export async function createMigrationTestFixture(prefix: string, migrationName: string) {
	const testDirectory = await mkdtemp(join(tmpdir(), prefix));
	const dataDirectory = join(testDirectory, 'data');
	const legacyMigrations = join(testDirectory, 'legacy-migrations');
	const migrationsDirectory = join(projectDirectory, 'pocketbase', 'pb_migrations');
	await mkdir(dataDirectory);
	await mkdir(legacyMigrations);
	for (const file of await readdir(migrationsDirectory)) {
		if (file.endsWith('.js') && file < migrationName) {
			await copyFile(join(migrationsDirectory, file), join(legacyMigrations, basename(file)));
		}
	}
	const port = 18_000 + Math.floor(Math.random() * 10_000);
	return {
		testDirectory,
		dataDirectory,
		legacyMigrations,
		migrationsDirectory,
		port,
		baseUrl: `http://127.0.0.1:${port}`
	};
}

async function waitForPocketBase(url: string): Promise<void> {
	for (let attempt = 0; attempt < 1000; attempt++) {
		try {
			if ((await fetch(`${url}/api/health`)).ok) return;
		} catch {
			// The child process is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
	throw new Error('Timed out waiting for the PocketBase test server');
}

export async function startPocketBase(options: {
	baseUrl: string;
	port: number;
	dataDirectory: string;
	migrationsDirectory: string;
	serviceEmail: string;
	servicePassword: string;
}): Promise<ChildProcess> {
	const binary = join(projectDirectory, 'pocketbase', 'pocketbase');
	const hooksDirectory = join(projectDirectory, 'pocketbase', 'pb_hooks');
	const environment = {
		...process.env,
		PB_USER: options.serviceEmail,
		PB_PASS: options.servicePassword
	} as unknown as NodeJS.ProcessEnv;
	// Fresh PocketBase data directories otherwise launch the one-time superuser URL via xdg-open.
	// Provisioning the deterministic test superuser before `serve` keeps every harness headless.
	await execFileAsync(
		binary,
		[
			'superuser',
			'upsert',
			testSuperuserEmail,
			testSuperuserPassword,
			`--dir=${options.dataDirectory}`,
			`--migrationsDir=${options.migrationsDirectory}`,
			`--hooksDir=${hooksDirectory}`,
			'--hooksWatch=false'
		],
		{ cwd: projectDirectory, env: environment }
	);
	const server = spawn(
		binary,
		[
			'serve',
			`--http=127.0.0.1:${options.port}`,
			`--dir=${options.dataDirectory}`,
			`--migrationsDir=${options.migrationsDirectory}`,
			`--hooksDir=${hooksDirectory}`,
			'--hooksWatch=false'
		],
		{
			cwd: projectDirectory,
			env: environment,
			stdio: 'ignore'
		}
	);
	await waitForPocketBase(options.baseUrl);
	return server;
}

export async function stopPocketBase(server: ChildProcess): Promise<void> {
	if (server.exitCode !== null) return;
	server.kill('SIGTERM');
	await once(server, 'exit');
}
