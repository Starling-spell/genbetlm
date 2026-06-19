import type { WalletPosition, WalletSnapshot } from "./types";

const BASE_URL = "https://api.zerion.io/v1";

type ZerionPosition = {
  id: string;
  attributes?: {
    name?: string;
    quantity?: { float?: number };
    value?: number;
    price?: number;
    changes?: { percent_1d?: number | null };
    position_type?: string;
    protocol?: string | null;
    fungible_info?: {
      symbol?: string;
      name?: string;
      flags?: { verified?: boolean };
    };
    flags?: { displayable?: boolean; is_trash?: boolean };
    application_metadata?: { name?: string | null };
  };
  relationships?: {
    chain?: { data?: { id?: string } };
  };
};

type ZerionPortfolio = {
  data?: {
    attributes?: {
      positions_distribution_by_type?: Record<string, number>;
      positions_distribution_by_chain?: Record<string, number>;
      total?: { positions?: number };
      changes?: {
        absolute_1d?: number | null;
        percent_1d?: number | null;
      };
    };
  };
};

function getAuthorizationHeader() {
  const apiKey = process.env.ZERION_API_KEY;

  if (!apiKey) {
    return null;
  }

  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

async function zerionFetch<T>(path: string, params: Record<string, string>) {
  const authorization = getAuthorizationHeader();

  if (!authorization) {
    throw new Error("ZERION_API_KEY is not configured.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization
    },
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zerion API ${response.status}: ${body.slice(0, 400)}`);
  }

  return (await response.json()) as T;
}

function normalizePortfolio(response: ZerionPortfolio) {
  const attributes = response.data?.attributes;

  return {
    totalUsd: attributes?.total?.positions ?? 0,
    dayChangeUsd: attributes?.changes?.absolute_1d ?? null,
    dayChangePercent: attributes?.changes?.percent_1d ?? null,
    byChain: attributes?.positions_distribution_by_chain ?? {},
    byType: attributes?.positions_distribution_by_type ?? {}
  };
}

function normalizePosition(position: ZerionPosition): WalletPosition {
  const attributes = position.attributes ?? {};
  const fungible = attributes.fungible_info ?? {};

  return {
    id: position.id,
    symbol: fungible.symbol ?? attributes.name ?? "TOKEN",
    name: fungible.name ?? attributes.name ?? "Unknown token",
    chain: position.relationships?.chain?.data?.id ?? "unknown",
    quantity: attributes.quantity?.float ?? null,
    valueUsd: attributes.value ?? 0,
    priceUsd: attributes.price ?? null,
    dayChangePercent: attributes.changes?.percent_1d ?? null,
    type: attributes.position_type ?? "wallet",
    protocol: attributes.application_metadata?.name ?? attributes.protocol ?? null,
    verified: Boolean(fungible.flags?.verified)
  };
}

export async function getWalletSnapshot(address: string): Promise<WalletSnapshot> {
  if (!getAuthorizationHeader()) {
    return getDemoWalletSnapshot(address);
  }

  const [portfolioResponse, positionsResponse] = await Promise.all([
    zerionFetch<ZerionPortfolio>(`/wallets/${address}/portfolio`, {
      currency: "usd",
      "filter[positions]": "no_filter"
    }),
    zerionFetch<{ data?: ZerionPosition[] }>(`/wallets/${address}/positions/`, {
      currency: "usd",
      sort: "-value",
      "page[size]": "12",
      "filter[positions]": "no_filter",
      "filter[trash]": "only_non_trash"
    })
  ]);

  return {
    address,
    source: "zerion",
    generatedAt: new Date().toISOString(),
    portfolio: normalizePortfolio(portfolioResponse),
    positions: (positionsResponse.data ?? []).map(normalizePosition)
  };
}

export function compactWalletContext(snapshot: WalletSnapshot) {
  const topPositions = snapshot.positions.slice(0, 8).map((position) => ({
    symbol: position.symbol,
    chain: position.chain,
    value_usd: Number(position.valueUsd.toFixed(2)),
    quantity: position.quantity,
    type: position.type,
    protocol: position.protocol,
    verified: position.verified
  }));

  return {
    address: snapshot.address,
    source: snapshot.source,
    total_usd: Number(snapshot.portfolio.totalUsd.toFixed(2)),
    day_change_percent: snapshot.portfolio.dayChangePercent,
    chains: snapshot.portfolio.byChain,
    position_types: snapshot.portfolio.byType,
    top_positions: topPositions
  };
}

export function getDemoWalletSnapshot(address: string): WalletSnapshot {
  return {
    address,
    source: "demo",
    generatedAt: new Date().toISOString(),
    notice: "Using demo wallet data because ZERION_API_KEY is not configured.",
    portfolio: {
      totalUsd: 48216.92,
      dayChangeUsd: 384.21,
      dayChangePercent: 0.8,
      byChain: {
        ethereum: 27420.3,
        base: 8610.44,
        arbitrum: 5520.18,
        optimism: 3410.2,
        polygon: 3255.8
      },
      byType: {
        wallet: 34420.8,
        staked: 8205.2,
        deposited: 4465.4,
        locked: 1125.52
      }
    },
    positions: [
      {
        id: "demo-eth",
        symbol: "ETH",
        name: "Ether",
        chain: "ethereum",
        quantity: 7.42,
        valueUsd: 23852.4,
        priceUsd: 3214.61,
        dayChangePercent: 1.12,
        type: "wallet",
        protocol: null,
        verified: true
      },
      {
        id: "demo-usdc",
        symbol: "USDC",
        name: "USD Coin",
        chain: "base",
        quantity: 8200,
        valueUsd: 8200,
        priceUsd: 1,
        dayChangePercent: 0,
        type: "wallet",
        protocol: null,
        verified: true
      },
      {
        id: "demo-aave",
        symbol: "AAVE",
        name: "Aave",
        chain: "arbitrum",
        quantity: 38.5,
        valueUsd: 4120.36,
        priceUsd: 107.02,
        dayChangePercent: -2.2,
        type: "deposit",
        protocol: "Aave",
        verified: true
      },
      {
        id: "demo-op",
        symbol: "OP",
        name: "Optimism",
        chain: "optimism",
        quantity: 1880,
        valueUsd: 3233.6,
        priceUsd: 1.72,
        dayChangePercent: 3.1,
        type: "staked",
        protocol: "Optimism Governance",
        verified: true
      },
      {
        id: "demo-rpl",
        symbol: "RPL",
        name: "Rocket Pool",
        chain: "ethereum",
        quantity: 84,
        valueUsd: 2635.68,
        priceUsd: 31.38,
        dayChangePercent: -0.42,
        type: "wallet",
        protocol: null,
        verified: true
      }
    ]
  };
}
