<script lang="ts">
	import { getUserContext } from '$lib/stores/user.svelte';
	import pb from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	const user = getUserContext();
</script>

<div class="bg-base-200 fixed z-[1000] flex h-16 w-full items-center justify-start pl-2 text-white">
	<div class="flex flex-1/2 items-center justify-start gap-2">
		<div id="logo-container" class="flex h-[64px] w-10 flex-col justify-center gap-2">
			<enhanced:img src="/static/logo.png" alt="Logo" class="h-auto w-full" />
		</div>
		<!-- <label class="input input-sm">
		<span class="label">₽</span>
		<input type="text" placeholder="URL" />
	</label> -->
	</div>
	<div class="flex flex-1/2 items-center justify-end gap-2 pr-2">
		<details class="dropdown dropdown-end">
			<summary class="list-none">
				<div class="avatar avatar-placeholder cursor-pointer">
					<div class="bg-neutral text-neutral-content w-12 rounded-full">
						<span>{user?.name?.charAt(0).toUpperCase()}</span>
					</div>
				</div></summary
			>
			<ul class="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
				<li><a>Profile</a></li>
				<li>
					<a
						onclick={() => {
							pb.authStore.clear();
							goto('/');
						}}>Logout</a
					>
				</li>
			</ul>
		</details>
	</div>
</div>
