<script lang="ts">
	type NamedRecord = { id: string; name: string; race?: string };
	type MarketBook = {
		winnerType?: string;
		winnerName?: string;
		winnerCutoff?: string;
		winnerSelections?: { racerId: string; odds: number }[];
	};
	type WagerRecord = {
		id: string;
		stake: number;
		odds: number;
		potentialPayout: number;
		payout: number;
		status: string;
		expand?: { race?: { name?: string }; selection?: { name?: string } };
	};
	let {
		data,
		form
	}: {
		data: {
			balance: number;
			requestId: string;
			races: Array<NamedRecord & { bettingCutoff: string; markets: MarketBook }>;
			racers: NamedRecord[];
			openWagers: WagerRecord[];
			historicalWagers: WagerRecord[];
		};
		form?: { success?: boolean; error?: string };
	} = $props();

	const formatMoney = (amount: number) => `₽${Number(amount).toLocaleString('en-GB')}`;
	const formatCutoff = (value: string) =>
		new Date(value).toLocaleString('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		});
	const racerName = (id: string) => data.racers.find((racer) => racer.id === id)?.name ?? id;
	const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-y-auto p-4">
	<header class="flex items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Race wagering</h1>
			<p class="text-sm opacity-70">Fixed odds are locked when your wager is accepted.</p>
		</div>
		<p class="font-semibold">Available {formatMoney(data.balance)}</p>
	</header>

	{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
	{#if form?.success}<p class="alert alert-success" role="status">Wager placed.</p>{/if}

	<section aria-labelledby="markets-heading">
		<h2 id="markets-heading" class="mb-3 text-xl font-semibold">Upcoming markets</h2>
		{#if data.races.length === 0}
			<p class="rounded-box bg-base-200 p-4">No races are currently open for wagering.</p>
		{:else}
			<div class="grid gap-4 md:grid-cols-2">
				{#each data.races as race}
					<div class="card bg-base-200 shadow-sm">
						<div class="card-body">
							<h3 class="card-title">{race.name}</h3>
							<p>{race.markets.winnerName ?? 'Race winner'}</p>
							<p class="text-sm">Closes {formatCutoff(race.bettingCutoff)} UTC</p>
							<div class="flex flex-col gap-3">
								{#each race.markets.winnerSelections ?? [] as selection}
									<form method="POST" action="?/place" class="rounded-box bg-base-100 p-3">
										<input type="hidden" name="raceId" value={race.id} />
										<input type="hidden" name="selection" value={selection.racerId} />
										<input type="hidden" name="requestId" value={data.requestId} />
										<div class="mb-2 flex justify-between">
											<strong>{racerName(selection.racerId)}</strong>
											<span>{selection.odds.toFixed(2)}</span>
										</div>
										<div class="flex gap-2">
											<label class="input input-bordered flex-1">
												<span class="label">₽</span>
												<input name="stake" type="number" min="0.01" step="0.01" required />
											</label>
											<button class="btn btn-primary" type="submit">Place wager</button>
										</div>
									</form>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section aria-labelledby="open-wagers-heading">
		<h2 id="open-wagers-heading" class="mb-3 text-xl font-semibold">Open wagers</h2>
		<div class="grid gap-3 md:grid-cols-2">
			{#each data.openWagers as wager}
				<article class="card bg-base-200 p-4">
					<strong>{wager.expand?.race?.name ?? 'Race'}</strong>
					<span>{wager.expand?.selection?.name ?? 'Selection'} at {wager.odds.toFixed(2)}</span>
					<span>Stake {formatMoney(wager.stake)}</span>
					<span>Potential payout {formatMoney(wager.potentialPayout)}</span>
				</article>
			{:else}
				<p>No open wagers.</p>
			{/each}
		</div>
	</section>

	<section aria-labelledby="history-heading">
		<h2 id="history-heading" class="mb-3 text-xl font-semibold">Wager history</h2>
		<div class="overflow-x-auto">
			<table class="table">
				<thead
					><tr><th>Race</th><th>Selection</th><th>Outcome</th><th>Stake</th><th>Payout</th></tr
					></thead
				>
				<tbody>
					{#each data.historicalWagers as wager}
						<tr>
							<td>{wager.expand?.race?.name ?? 'Race'}</td>
							<td>{wager.expand?.selection?.name ?? 'Selection'}</td>
							<td>{statusLabel(wager.status)}</td>
							<td>{formatMoney(wager.stake)}</td>
							<td>Payout {formatMoney(wager.payout)}</td>
						</tr>
					{:else}
						<tr><td colspan="5">No wager history yet.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
