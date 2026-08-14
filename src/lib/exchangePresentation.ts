export function formatMarketNumber(
	value: number | null | undefined,
	maximumFractionDigits = 2
): string {
	return value === null || value === undefined || !Number.isFinite(value)
		? 'N/A'
		: value.toLocaleString(undefined, { maximumFractionDigits });
}

export function formatMarketPrice(value: number | null | undefined): string {
	const formatted = formatMarketNumber(value);
	return formatted === 'N/A' ? formatted : `₽${formatted}`;
}

export function formatMarketMovement(value: number | null, percentage: number | null): string {
	if (value === null || percentage === null) return 'Change unavailable';
	const sign = value > 0 ? '+' : '';
	return `${sign}${value.toFixed(2)} (${sign}${percentage.toFixed(2)}%)`;
}
