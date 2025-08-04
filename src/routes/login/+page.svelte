<script lang="ts">
	let error = '';
	let loading = $state(false);

	let pageState: 'start' | 'login' | 'register' = $state('start');
	//svelte-ignore non_reactive_update
	let loginForm: HTMLFormElement;
	//svelte-ignore non_reactive_update
	let registerForm: HTMLFormElement;
</script>

<div class="flex h-full flex-col items-center gap-4 p-4">
	{#if pageState === 'start'}
		<div class="flex h-full items-center justify-center">
			<enhanced:img src="/static/logo-alt.png" alt="Logo" class="size-90" />
		</div>

		<div class="flex h-32 w-full flex-col gap-4 lg:max-w-96">
			<button class="btn btn-lg btn-primary" onclick={() => (pageState = 'login')}>Login</button>
			<button class="btn btn-lg btn-secondary" onclick={() => (pageState = 'register')}
				>Register</button
			>
		</div>
	{:else if pageState === 'login'}
		<div class="flex h-16 w-full items-center justify-start gap-4 p-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6 cursor-pointer"
				onclick={() => (pageState = 'start')}
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
				/>
			</svg>
		</div>

		{#if error}
			<div class="alert alert-error mt-2">
				<span>{error}</span>
			</div>
		{/if}

		<form
			id="login-form"
			class="flex h-full w-full flex-col items-center justify-center gap-4"
			bind:this={loginForm}
			method="post"
		>
			<div class="text-center text-3xl">Sign In</div>
			<input
				name="email"
				class="input input-lg"
				type="email"
				required
				placeholder="mail@site.com"
			/>

			<input
				name="password"
				type="password"
				class="input input-lg"
				required
				placeholder="Password"
			/>
		</form>
		<div class="flex h-16 w-full flex-col gap-4 lg:max-w-96">
			<button
				onclick={() => {
					loading = true;
					loginForm.submit();
				}}
				class="btn btn-lg btn-primary w-full lg:max-w-96"
				type="button"
				disabled={loading}
			>
				{loading ? 'Logging in...' : 'Login'}
			</button>
		</div>
	{:else if pageState === 'register'}
		<div class="flex h-16 w-full items-center justify-start gap-4 p-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="size-6 cursor-pointer"
				onclick={() => (pageState = 'start')}
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
				/>
			</svg>
		</div>
		<form
			id="register-form"
			bind:this={registerForm}
			class="flex h-full w-full flex-col items-center justify-center gap-4"
			method="post"
		>
			<div class="text-center text-3xl">Sign Up</div>
			<input
				name="email"
				class="input input-lg"
				type="email"
				required
				placeholder="mail@site.com"
			/>

			<input
				name="password"
				type="password"
				class="input input-lg"
				required
				placeholder="Password"
			/>

			<input
				name="confirmPassword"
				type="password"
				class="input input-lg"
				required
				placeholder="Confirm Password"
			/>
		</form>
		<button
			form="register-form"
			onclick={() => {
				loading = true;
				registerForm.submit();
			}}
			class="btn btn-lg btn-primary w-full lg:max-w-96"
			type="submit"
			disabled={loading}
		>
			{loading ? 'Registering...' : 'Register'}
		</button>
	{/if}
</div>
