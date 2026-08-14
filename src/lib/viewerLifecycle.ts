type EventListenerTarget = {
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: unknown
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: unknown
	): void;
};

type TickerTarget<TCallback> = {
	add(callback: TCallback): unknown;
	remove(callback: TCallback): unknown;
};

type Disposer = () => unknown;

export function createViewerLifecycle(
	onDisposeError: (error: unknown) => void = (error) =>
		console.warn('Race viewer resource cleanup failed', error)
) {
	const listeners: Disposer[] = [];
	const tickers: Disposer[] = [];
	const assets: Disposer[] = [];
	const renderers: Disposer[] = [];
	const assetSources = new Set<string>();
	let disposed = false;

	function register(disposers: Disposer[], disposer: Disposer): void {
		if (disposed) {
			try {
				void Promise.resolve(disposer()).catch(onDisposeError);
			} catch (error) {
				onDisposeError(error);
			}
			return;
		}
		disposers.push(disposer);
	}

	return {
		get disposed() {
			return disposed;
		},
		listen(
			target: EventListenerTarget,
			type: string,
			listener: EventListenerOrEventListenerObject,
			options?: unknown
		) {
			target.addEventListener(type, listener, options);
			register(listeners, () => target.removeEventListener(type, listener, options));
		},
		tick<TCallback>(target: TickerTarget<TCallback>, callback: TCallback) {
			target.add(callback);
			register(tickers, () => target.remove(callback));
		},
		asset(source: string, unload: (source: string) => unknown) {
			if (assetSources.has(source)) return;
			assetSources.add(source);
			register(assets, () => unload(source));
		},
		renderer(destroy: Disposer) {
			register(renderers, destroy);
		},
		async dispose() {
			if (disposed) return;
			disposed = true;
			for (const group of [tickers, listeners, renderers, assets]) {
				for (const dispose of group.splice(0).reverse()) {
					try {
						await dispose();
					} catch (error) {
						onDisposeError(error);
					}
				}
			}
		}
	};
}

export function createViewerLifecycleManager(onDisposeError?: (error: unknown) => void) {
	let current = createViewerLifecycle(onDisposeError);

	return {
		get current() {
			return current;
		},
		async replace() {
			const previous = current;
			const replacement = createViewerLifecycle(onDisposeError);
			current = replacement;
			await previous.dispose();
			return replacement;
		},
		dispose() {
			return current.dispose();
		}
	};
}
