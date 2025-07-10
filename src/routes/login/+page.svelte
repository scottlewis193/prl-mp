<script lang="ts">
	let error = '';
	let loading = false;
</script>

<div class="bg-base-200 flex min-h-screen items-center justify-center px-4">
	<div class="card bg-base-100 w-full max-w-md shadow-xl">
		<div class="card-body">
			<img src="./logo.png" alt="Logo" />

			{#if error}
				<div class="alert alert-error mt-2">
					<span>{error}</span>
				</div>
			{/if}
			<form method="post">
				<div class="form-control flex w-full flex-col items-center justify-center">
					<input
						name="email"
						class="input validator"
						type="email"
						required
						placeholder="mail@site.com"
					/>
					<div class="validator-hint">Enter valid email address</div>
				</div>

				<div class="form-control flex w-full flex-col items-center justify-center">
					<input
						name="password"
						type="password"
						class="input validator"
						required
						placeholder="Password"
					/>
				</div>

				<div class="form-control flex w-full flex-col items-center justify-center">
					<button
						class="btn btn-primary w-[clamp(3rem,20rem,100%)]"
						type="submit"
						disabled={loading}
					>
						{loading ? 'Logging in...' : 'Login'}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
