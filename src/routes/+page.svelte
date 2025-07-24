<script lang="ts">
	import { goto } from '$app/navigation';
	import type { AuthRecord } from 'pocketbase';

	let { data }: { data: { user: AuthRecord; url: string } } = $props();
	const user = data?.user;
</script>

<div class="flex h-full w-full justify-center">
	<div id="stats-container" class="flex h-full w-[120rem] flex-col gap-4 p-4">
		<div class="card card-border bg-base-200 w-96">
			<div class="stats shadow">
				<div class="stat">
					<div class="stat-title">Money</div>
					<div class="stat-value">₽89,400</div>
					<div class="stat-desc"></div>
				</div>
			</div>
		</div>
	</div>
</div>
