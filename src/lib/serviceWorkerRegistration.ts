type ServiceWorkerLike = {
	scriptURL: string;
};

type ServiceWorkerRegistrationLike = {
	active?: ServiceWorkerLike | null;
	installing?: ServiceWorkerLike | null;
	waiting?: ServiceWorkerLike | null;
	unregister(): Promise<boolean>;
};

type ServiceWorkerContainerLike = {
	getRegistrations(): Promise<readonly ServiceWorkerRegistrationLike[]>;
};

const legacyWorkerPaths = new Set(['/service-worker.js', '/sw.js']);

function workerPath(registration: ServiceWorkerRegistrationLike): string | undefined {
	const scriptURL =
		registration.active?.scriptURL ??
		registration.waiting?.scriptURL ??
		registration.installing?.scriptURL;
	if (!scriptURL) return undefined;
	try {
		return new URL(scriptURL).pathname;
	} catch {
		return undefined;
	}
}

export async function unregisterLegacyServiceWorkers(
	serviceWorkers: ServiceWorkerContainerLike
): Promise<void> {
	try {
		const registrations = await serviceWorkers.getRegistrations();
		await Promise.allSettled(
			registrations
				.filter((registration) => legacyWorkerPaths.has(workerPath(registration) ?? ''))
				.map((registration) => registration.unregister())
		);
	} catch {
		// Service-worker storage can be unavailable; cleanup must not break application startup.
	}
}
