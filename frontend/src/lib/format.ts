/**
 * Format a monetary value stored in cents as a USD currency string.
 *
 * All backend monetary fields (job_value, total_revenue, unit_price, etc.)
 * are stored as integers representing **cents**. This helper converts to
 * dollars for display.
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Compact currency format for KPI cards (e.g. "$12.5k").
 */
export function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toLocaleString()}`;
}
