<script lang="ts">
	import type { RaceTrack } from '$lib/racetrack';

	let { racetrack, isPreview = false }: { racetrack: RaceTrack; isPreview?: boolean } = $props();
</script>

<svg
	class="track-svg"
	viewBox="0 0 {racetrack.maxSize.x} {racetrack.maxSize.y}"
	xmlns="http://www.w3.org/2000/svg"
	preserveAspectRatio="xMidYMid meet"
	style={isPreview
		? ''
		: `
					top: 0;
					left: 0;
					width: {racetrack.maxSize.x}px;
					height: {racetrack.maxSize.y}px;
					position: absolute;
					pointer-events: none;
					z-index: 1;
				`}
>
	<!-- Optional: draw lines between checkpoints -->

	{#each Object.values(racetrack.checkpoints) as point, i}
		{#if i < Object.values(racetrack.checkpoints).length - 1}
			<line
				x1={point.x}
				y1={point.y}
				x2={racetrack.checkpoints[i + 1].x}
				y2={racetrack.checkpoints[i + 1].y}
				stroke="grey"
				stroke-width={racetrack.width}
				stroke-linecap="round"
			/>
		{/if}
	{/each}

	<!-- Optional: close the loop visually -->
	<line
		x1={racetrack.checkpoints[Object.values(racetrack.checkpoints).length - 1].x}
		y1={racetrack.checkpoints[Object.values(racetrack.checkpoints).length - 1].y}
		x2={racetrack.checkpoints[0].x}
		y2={racetrack.checkpoints[0].y}
		stroke="grey"
		stroke-width={racetrack.width}
		stroke-linecap="round"
	/>

	<!-- draw start line -->
	<line
		x1={racetrack.checkpoints[0].x - 32 / 4}
		y1={racetrack.checkpoints[0].y - racetrack.width / 2}
		x2={racetrack.checkpoints[0].x - 32 / 4}
		y2={racetrack.checkpoints[0].y + racetrack.width / 2}
		stroke="white"
		stroke-width={32}
		stroke-linecap="square"
	/>

	<!-- Draw checkpoints as circles -->
	<!-- {#each checkpoints as { x, y }, i}
					<circle cx={x} cy={y} r="8" fill="black" stroke="white" stroke-width="2" />
					<text x={x + 10} y={y + 5} font-size="14" fill="white">
						{i + 1}
					</text>
				{/each} -->
</svg>
