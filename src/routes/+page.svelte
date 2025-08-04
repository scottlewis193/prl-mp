<script lang="ts">

	import type { AuthRecord } from 'pocketbase';

	let { data }: { data: { user: AuthRecord; url: string } } = $props();
	const user = data?.user;

	async function sendTestNotification() {
		await fetch('/api/notify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: '🔥 New Race Started!',
				body: 'Your Pokémon is now racing!'
			})
		});
	}
</script>

<div class="flex h-full w-full flex-wrap gap-4 overflow-y-auto p-4">
	<div class="card card-border bg-base-200 w-full lg:w-96">
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-title">Money</div>
				<div class="stat-value">₽89,400</div>
				<div class="stat-desc">+1% Today</div>
			</div>
		</div>
	</div>
	<div class="card card-border bg-base-200 w-full lg:w-96">
		<button
			onclick={() => {
				sendTestNotification();
			}}>Send Test Notification</button
		>
	</div>
	<div class="card card-border bg-base-200 h-full w-full lg:w-1/2">
		<div class="card-body">
			Holdings Performance
			<div class="overflow-x-auto">
				<table class="table">
					<tbody>
						<!-- row 1 -->
						<tr>
							<td>
								<div class="flex items-center gap-3">
									<div class="avatar">
										<div class="mask mask-squircle h-12 w-12">
											<img src="" alt="Avatar Tailwind CSS Component" />
										</div>
									</div>
									<div>
										<div class="font-bold">Test</div>
									</div>
								</div>
							</td>
							<td>+1%</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
	<div class="card bg-base-200 h-full w-full lg:w-[calc(50%-1rem)]">
		<div class="card-body">News</div>
	</div>
</div>
