<script lang="ts">
	import { createEmptyTrainerCareer } from '$lib/trainerCareer';
	import type { Trainer, TrainerRaceResult } from '$lib/types';

	let { trainers, results }: { trainers: Trainer[]; results: TrainerRaceResult[] } = $props();
	const emptyCareer = createEmptyTrainerCareer();
	const byTrainer = $derived(
		new Map(
			trainers.map((trainer) => [
				trainer.id,
				results.filter((result) => result.trainer === trainer.id).slice(0, 10)
			])
		)
	);
</script>

<main class="h-full overflow-y-auto p-4">
	<div class="mx-auto max-w-5xl">
		<h1 class="text-2xl font-bold">Trainer careers</h1>
		<p class="text-base-content/70 mb-4">Career records from official settled races.</p>
		<div class="grid gap-4 md:grid-cols-2">
			{#each trainers as trainer}
				{@const career = trainer.career ?? emptyCareer}
				<section class="card bg-base-200 shadow-sm">
					<div class="card-body gap-3">
						<h2 class="card-title">{trainer.name}</h2>
						<dl class="stats stats-vertical bg-base-100 sm:stats-horizontal grid grid-cols-3">
							<div class="stat p-3">
								<dt class="stat-title">Starts</dt>
								<dd class="stat-value text-xl">{career.starts}</dd>
							</div>
							<div class="stat p-3">
								<dt class="stat-title">Wins</dt>
								<dd class="stat-value text-xl">{career.wins}</dd>
							</div>
							<div class="stat p-3">
								<dt class="stat-title">Podiums</dt>
								<dd class="stat-value text-xl">{career.podiums}</dd>
							</div>
							<div class="stat p-3">
								<dt class="stat-title">Earnings</dt>
								<dd class="stat-value text-xl">₽{career.earnings}</dd>
							</div>
							<div class="stat p-3">
								<dt class="stat-title">Championships</dt>
								<dd class="stat-value text-xl">{career.championships}</dd>
							</div>
						</dl>
						<h3 class="font-semibold">Recent results</h3>
						{#if (byTrainer.get(trainer.id) ?? []).length === 0}
							<p class="text-base-content/60">No official results yet.</p>
						{:else}
							<ul class="divide-base-300 divide-y">
								{#each byTrainer.get(trainer.id) ?? [] as result}
									<li class="flex justify-between py-2">
										<span
											>{result.expand?.racer?.name ?? 'Unknown racer'} · {result.expand?.race
												?.name ?? 'Race'}</span
										>
										<strong
											>{result.outcome === 'dnf' ? 'DNF' : `#${result.position}`} · ₽{result.earnings}</strong
										>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</section>
			{/each}
		</div>
	</div>
</main>
