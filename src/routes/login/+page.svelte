<script lang="ts">
	let error = '';
	let loading = false;
</script>

<div class="flex h-full items-center justify-center">
	<div class="card bg-base-200 w-full max-w-md shadow-xl">
		<div class="card-body p-8">
			<div class="flex items-center justify-center">
				<enhanced:img src="/static/logo.png" alt="Logo" class="size-60" />
			</div>
			{#if error}
				<div class="alert alert-error mt-2">
					<span>{error}</span>
				</div>
			{/if}
			<form class="flex flex-col items-center justify-center gap-4" method="post">
				<input name="email" class="input" type="email" required placeholder="mail@site.com" />

				<input name="password" type="password" class="input" required placeholder="Password" />

				<button class="btn btn-primary w-[clamp(3rem,20rem,100%)]" type="submit" disabled={loading}>
					{loading ? 'Logging in...' : 'Login'}
				</button>
			</form>
		</div>
	</div>
</div>
