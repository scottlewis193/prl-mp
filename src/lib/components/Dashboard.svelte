<script lang="ts">
	import type { DashboardView } from '$lib/dashboard';
	import { formatMarketPrice } from '$lib/exchangePresentation';
	import { formatRaceSchedule } from '$lib/raceDiscovery';

	let {
		dashboard = null,
		loading = false,
		error = null
	}: { dashboard?: DashboardView | null; loading?: boolean; error?: string | null } = $props();

	function signedPrice(value: number | null): string {
		if (value === null) return 'Return unavailable';
		if (value === 0) return formatMarketPrice(0);
		return `${value > 0 ? '+' : '-'}${formatMarketPrice(Math.abs(value))}`;
	}

	function signedPercent(value: number | null): string {
		if (value === null) return 'Return unavailable';
		return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
	}

	function activityTime(value: string): string {
		const date = new Date(value);
		return Number.isFinite(date.getTime())
			? `${date.toLocaleString('en-GB', {
					day: '2-digit',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit',
					hour12: false,
					timeZone: 'UTC'
				})} UTC`
			: 'Time unavailable';
	}

	function countLabel(count: number, singular: string): string {
		return `${count.toLocaleString()} ${singular}${count === 1 ? '' : 's'}`;
	}
</script>

{#if loading}
	<section class="flex h-full items-center justify-center p-6" aria-live="polite">
		<div class="flex items-center gap-3">
			<span class="loading loading-spinner loading-md" aria-hidden="true"></span>
			<p>Loading dashboard…</p>
		</div>
	</section>
{:else if error}
	<section class="p-4">
		<div class="alert alert-error" role="alert">
			<p>{error}</p>
		</div>
	</section>
{:else if dashboard}
	<div class="grid h-full w-full gap-4 overflow-y-auto p-4 lg:grid-cols-2 xl:grid-cols-3">
		<section class="card card-border bg-base-200 lg:col-span-2 xl:col-span-1">
			<div class="card-body">
				<h1 class="card-title">Your account</h1>
				<p class="text-4xl font-bold">{formatMarketPrice(dashboard.account.balance)}</p>
				<p
					class:!text-success={dashboard.account.change > 0}
					class:!text-error={dashboard.account.change < 0}
					class="text-base-content/70"
				>
					{signedPrice(dashboard.account.change)} · {dashboard.account.period}
				</p>
			</div>
		</section>

		<section class="card card-border bg-base-200 lg:col-span-2">
			<div class="card-body">
				<h2 class="card-title">Wagering activity</h2>
				<p class="text-base-content/70">
					{countLabel(dashboard.wagering.count, 'wager')} ·
					{countLabel(dashboard.wagering.open, 'open wager')}
				</p>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<p class="text-base-content/70 text-sm">Wins</p>
						<p>{countLabel(dashboard.wagering.wins, 'win')}</p>
					</div>
					<div>
						<p class="text-base-content/70 text-sm">Losses</p>
						<p>{countLabel(dashboard.wagering.losses, 'loss')}</p>
					</div>
					<div>
						<p class="text-base-content/70 text-sm">Refunds</p>
						<p>{countLabel(dashboard.wagering.refunds, 'refund')}</p>
					</div>
					<div>
						<p class="text-base-content/70 text-sm">Staked</p>
						<p>{formatMarketPrice(dashboard.wagering.totalStaked)}</p>
					</div>
					<div>
						<p class="text-base-content/70 text-sm">Payout</p>
						<p>{formatMarketPrice(dashboard.wagering.totalPayout)}</p>
					</div>
					<div>
						<p class="text-base-content/70 text-sm">Settled P/L</p>
						<p
							class:text-success={dashboard.wagering.profit > 0}
							class:text-error={dashboard.wagering.profit < 0}
						>
							{signedPrice(dashboard.wagering.profit)}
						</p>
					</div>
				</div>
			</div>
		</section>

		<section class="card card-border bg-base-200 lg:col-span-2">
			<div class="card-body">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 class="card-title">Holdings performance</h2>
						<p class="text-base-content/70">
							{countLabel(dashboard.trading.trades, 'trade')} ·
							{countLabel(dashboard.trading.buys, 'buy')} ·
							{countLabel(dashboard.trading.sells, 'sell')}
						</p>
						<p class="text-base-content/70">
							Market value {formatMarketPrice(dashboard.portfolio.marketValue)} from
							{formatMarketPrice(dashboard.portfolio.costBasis)} invested
						</p>
					</div>
					<div class="text-right">
						<p class="font-semibold">{signedPrice(dashboard.portfolio.gain)}</p>
						<p
							class:text-success={(dashboard.portfolio.gain ?? 0) > 0}
							class:text-error={(dashboard.portfolio.gain ?? 0) < 0}
						>
							{signedPercent(dashboard.portfolio.gainPercent)}
						</p>
					</div>
				</div>
				{#if dashboard.portfolio.holdings.length === 0}
					<p class="text-base-content/70 py-5">
						No holdings yet. Visit the exchange to invest in a racer.
					</p>
					<a class="btn btn-primary btn-sm self-start" href="/exchange">Browse exchange</a>
				{:else}
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr><th>Racer</th><th>Shares</th><th>Value</th><th>Return</th></tr>
							</thead>
							<tbody>
								{#each dashboard.portfolio.holdings as holding (holding.racerId)}
									<tr>
										<td class="font-semibold">{holding.racerName}</td>
										<td>{holding.quantity.toLocaleString()}</td>
										<td>{formatMarketPrice(holding.marketValue)}</td>
										<td
											class:text-success={(holding.gain ?? 0) > 0}
											class:text-error={(holding.gain ?? 0) < 0}
										>
											{signedPercent(holding.gainPercent)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</section>

		<section class="card card-border bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Upcoming races</h2>
				{#if dashboard.upcomingRaces.length === 0}
					<p class="text-base-content/70">No upcoming races are scheduled.</p>
				{:else}
					<ul class="divide-base-300 divide-y">
						{#each dashboard.upcomingRaces as race (race.id)}
							<li class="py-3">
								<a class="link link-hover font-semibold" href={`/races/${race.id}`}>{race.name}</a>
								<p>{race.trackName}</p>
								<p class="text-base-content/70 text-sm">{formatRaceSchedule(race.startTime)}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section class="card card-border bg-base-200">
			<div class="card-body">
				<h2 class="card-title">Recent results</h2>
				{#if dashboard.recentResults.length === 0}
					<p class="text-base-content/70">No recent results yet.</p>
				{:else}
					<ul class="divide-base-300 divide-y">
						{#each dashboard.recentResults as race (race.id)}
							<li class="py-3">
								<a class="link link-hover font-semibold" href={`/races/${race.id}`}>{race.name}</a>
								<p>{race.trackName} · Winner: {race.winnerName}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section class="card card-border bg-base-200 lg:col-span-2 xl:col-span-1">
			<div class="card-body">
				<h2 class="card-title">Watched racers</h2>
				{#if dashboard.watchedActivity.length === 0}
					<p class="text-base-content/70">
						No watched-racer activity yet. Add racers to your watchlist in the exchange.
					</p>
				{:else}
					<ul class="divide-base-300 divide-y">
						{#each dashboard.watchedActivity as activity (`${activity.racerId}-${activity.timestamp}-${activity.description}`)}
							<li class="py-3">
								<p><strong>{activity.racerName}</strong> · {activity.description}</p>
								<p class="text-base-content/70 text-sm">{activityTime(activity.timestamp)}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	</div>
{:else}
	<section class="p-4" aria-live="polite"><p>Loading dashboard…</p></section>
{/if}
