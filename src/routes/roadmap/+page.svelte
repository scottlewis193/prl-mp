<script lang="ts">
	import type { RoadmapSection } from './+page';

	let { data }: { data: { roadmap: RoadmapSection[] } } = $props();
</script>

<svelte:head>
	<title>Roadmap | Pokémon Racing League</title>
	<meta
		name="description"
		content="See what is active, planned, and completed for Pokémon Racing League."
	/>
</svelte:head>

<main class="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<header class="mb-8 max-w-3xl">
			<p class="text-primary mb-2 text-sm font-bold tracking-[0.2em] uppercase">Product roadmap</p>
			<h1 class="text-4xl font-bold sm:text-5xl">Building the league, one lap at a time</h1>
			<p class="text-base-content/70 mt-4 text-lg">
				This is a living view of our current direction. Priorities may move as the league grows and
				we learn from players.
			</p>
		</header>

		<div id="roadmap-container" class="grid gap-6 lg:grid-cols-3">
			{#each data.roadmap as section}
				<section class="card bg-base-200 border-base-100 border shadow-sm">
					<div class="card-body">
						<div class="flex items-start justify-between gap-4">
							<h2 class="card-title text-2xl">{section.title}</h2>
							<span
								class:badge-warning={section.status === 'active'}
								class:badge-info={section.status === 'planned'}
								class:badge-success={section.status === 'completed'}
								class="badge badge-soft shrink-0 capitalize"
							>
								{section.status}
							</span>
						</div>
						<p class="text-base-content/70 min-h-12">{section.summary}</p>

						<ul class="mt-2 space-y-3">
							{#each section.items as item}
								<li class="bg-base-100 rounded-box p-4">
									<h3 class="font-semibold">{item.title}</h3>
									<p class="text-base-content/70 mt-1 text-sm leading-relaxed">
										{item.description}
									</p>
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/each}
		</div>
	</div>
</main>
