<script lang="ts">
	import { quoteTrade, type TradeOrder, type TradeSide } from '$lib/exchangeTrade';

	let {
		unitPrice,
		balance,
		availableSupply,
		ownedQuantity,
		submitTrade
	}: {
		unitPrice: number;
		balance: number;
		availableSupply: number;
		ownedQuantity: number;
		submitTrade: (order: TradeOrder) => Promise<unknown>;
	} = $props();

	let side = $state<TradeSide>('buy');
	let quantityText = $state('1');
	let isSubmitting = $state(false);
	let submissionError = $state('');
	let submissionMessage = $state('');
	let pendingRequest = $state<{ signature: string; idempotencyKey: string }>();
	const quoteState = $derived.by(() => {
		try {
			return {
				quote: quoteTrade({
					side,
					quantity: Number(quantityText),
					unitPrice,
					balance,
					availableSupply,
					ownedQuantity
				}),
				error: ''
			};
		} catch (error) {
			return { quote: undefined, error: error instanceof Error ? error.message : 'Invalid trade.' };
		}
	});

	async function confirmTrade() {
		if (!quoteState.quote || isSubmitting) return;
		isSubmitting = true;
		submissionError = '';
		submissionMessage = '';
		try {
			const signature = `${side}:${quoteState.quote.quantity}`;
			if (!pendingRequest || pendingRequest.signature !== signature) {
				pendingRequest = { signature, idempotencyKey: crypto.randomUUID() };
			}
			await submitTrade({
				side,
				quantity: quoteState.quote.quantity,
				idempotencyKey: pendingRequest.idempotencyKey,
				expectedUnitPrice: quoteState.quote.unitPrice
			});
			pendingRequest = undefined;
			submissionMessage = `${side === 'buy' ? 'Purchase' : 'Sale'} completed.`;
		} catch (error) {
			submissionError = error instanceof Error ? error.message : 'Trade failed.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="trade-heading">
	<h2 id="trade-heading" class="text-base">Trade shares</h2>
	<div class="card bg-base-100">
		<form
			class="card-body gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				confirmTrade();
			}}
		>
			<div class="join w-full" aria-label="Trade side">
				<button
					type="button"
					class="btn join-item flex-1"
					class:btn-primary={side === 'buy'}
					aria-pressed={side === 'buy'}
					onclick={() => {
						side = 'buy';
						submissionError = '';
						submissionMessage = '';
					}}>Buy</button
				>
				<button
					type="button"
					class="btn join-item flex-1"
					class:btn-primary={side === 'sell'}
					aria-pressed={side === 'sell'}
					onclick={() => {
						side = 'sell';
						submissionError = '';
						submissionMessage = '';
					}}>Sell</button
				>
			</div>

			<label class="form-control">
				<span class="label-text pb-1">Share quantity</span>
				<input
					class="input input-bordered w-full"
					name="quantity"
					type="number"
					min="1"
					step="1"
					inputmode="numeric"
					bind:value={quantityText}
				/>
			</label>

			{#if quoteState.quote}
				<div class="flex justify-between" aria-live="polite">
					<strong>{side === 'buy' ? 'Total cost' : 'Total proceeds'}:</strong>
					<span>₽{quoteState.quote.total.toLocaleString()}</span>
				</div>
			{:else}
				<p class="text-error text-sm" role="alert">{quoteState.error}</p>
			{/if}

			{#if submissionError}<p class="text-error text-sm" role="alert">{submissionError}</p>{/if}
			{#if submissionMessage}<p class="text-success text-sm" role="status">
					{submissionMessage}
				</p>{/if}
			<button class="btn btn-primary" type="submit" disabled={!quoteState.quote || isSubmitting}>
				{isSubmitting ? 'Submitting…' : `Confirm ${side}`}
			</button>
		</form>
	</div>
</section>
