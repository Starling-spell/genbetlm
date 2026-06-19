export function formatUsd(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0.00%";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function shortAddress(address: string) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function topEntries(record: Record<string, number>, limit = 5) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
