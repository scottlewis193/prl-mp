<script lang="ts">
	import '../app.css';

	let { children, user, url }: { children: any; user: any; url: string } = $props();
	console.log(user);
</script>

{#if url !== '/login'}
	<div class="bg-base-200 flex h-[64px] flex-col items-start justify-center text-white">
		<div class="avatar avatar-placeholder">
			<div class="bg-neutral text-neutral-content w-12 rounded-full">
				<span></span>
			</div>
		</div>
	</div>
{/if}
{@render children()}
