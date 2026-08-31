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

	function movementLabel(zone: 'promotion' | 'relegation' | 'safe'): string {
		return zone === 'promotion' ? 'Promotion' : zone === 'relegation' ? 'Relegation' : 'Safe';
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

		<section class="card card-border bg-base-200 lg:col-span-2 xl:col-span-3">
			<div class="card-body">
				<h2 class="card-title">
					{dashboard.leagueTables?.[0]?.seasonName ?? 'Current season'} standings
				</h2>
				{#if !dashboard.leagueTables || dashboard.leagueTables.length === 0}
					<p class="text-base-content/70">No active league tables are available.</p>
				{:else}
					<div class="grid gap-4 xl:grid-cols-2">
						{#each dashboard.leagueTables as table (table.leagueId)}
							<section class="border-base-300 rounded-box overflow-hidden border">
								<h3 class="bg-base-300 px-4 py-3 text-lg font-semibold">{table.leagueName}</h3>
								<div class="overflow-x-auto">
									<table class="table-sm table">
										<thead>
											<tr>
												<th>Position</th>
												<th>Racer</th>
												<th>Points</th>
												<th>Starts</th>
												<th>Wins</th>
												<th>Podiums</th>
												<th>Best</th>
												<th>Recent form</th>
												<th>Movement</th>
											</tr>
										</thead>
										<tbody>
											{#each table.rows as row (row.racerId)}
												<tr
													class={row.movementZone === 'promotion'
														? 'bg-success/10'
														: row.movementZone === 'relegation'
															? 'bg-error/10'
															: ''}
												>
													<td>{row.position}</td>
													<td class="font-semibold">{row.racerName}</td>
													<td>{row.points}</td>
													<td>{row.starts}</td>
													<td>{row.wins}</td>
													<td>{row.podiums}</td>
													<td>{row.bestFinish || '—'}</td>
													<td>{row.recentForm.length > 0 ? row.recentForm.join(' · ') : '—'}</td>
													<td>{movementLabel(row.movementZone)}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</section>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="card card-border bg-base-200 lg:col-span-2 xl:col-span-3">
			<div class="card-body">
				<h2 class="card-title">Previous seasons</h2>
				{#if dashboard.priorSeasons.length === 0}
					<p class="text-base-content/70">No completed seasons yet.</p>
				{:else}
					{#each dashboard.priorSeasons as season (season.seasonId)}
						<section class="border-base-300 rounded-box overflow-hidden border">
							<h3 class="bg-base-300 px-4 py-3 text-lg font-semibold">
								{season.seasonName} · completed {activityTime(season.endedAt)}
							</h3>
							<div class="grid gap-4 p-4 xl:grid-cols-2">
								{#each season.leagueTables as table (table.leagueId)}
									<section>
										<h4 class="font-semibold">{table.leagueName}</h4>
										<div class="overflow-x-auto">
											<table class="table-sm table">
												<thead>
													<tr>
														<th>Position</th><th>Racer</th><th>Points</th><th>Starts</th><th
															>Wins</th
														><th>Podiums</th><th>Best</th><th>Recent form</th><th>Award</th>
													</tr>
												</thead>
												<tbody>
													{#each table.rows as row (row.racerId)}
														<tr>
															<td>{row.position}</td>
															<td class="font-semibold">{row.racerName}</td>
															<td>{row.points}</td>
															<td>{row.starts}</td>
															<td>{row.wins}</td>
															<td>{row.podiums}</td>
															<td>{row.bestFinish || '—'}</td>
															<td>{row.recentForm.length > 0 ? row.recentForm.join(' · ') : '—'}</td
															>
															<td>{row.awardName ? 'Champion' : '—'}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</section>
								{/each}
							</div>
						</section>
					{/each}
				{/if}
			</div>
		</section>

		<section class="card card-border bg-base-200 lg:col-span-2 xl:col-span-3">
			<div class="card-body">
				<h2 class="card-title">Promotion and relegation history</h2>
				{#if dashboard.racerMovementHistory.length === 0}
					<p class="text-base-content/70">No promotion or relegation history yet.</p>
				{:else}
					<ul class="divide-base-300 divide-y">
						{#each dashboard.racerMovementHistory as movement (`${movement.seasonName}-${movement.racerId}`)}
							<li class="py-3">
								<strong>{movement.racerName}</strong> ·
								{movement.direction === 'promoted' ? 'Promoted' : 'Relegated'} from
								{movement.fromLeagueName} to {movement.toLeagueName} after finishing
								{movement.fromPosition} in {movement.seasonName}
							</li>
						{/each}
					</ul>
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
