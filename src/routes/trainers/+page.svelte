<script lang="ts">
	import TrainerCareers from '$lib/components/TrainerCareers.svelte';
	let { data } = $props();
</script>

<TrainerCareers trainers={data.trainers} results={data.results} />
