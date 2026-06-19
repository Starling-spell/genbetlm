export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WalletPortfolio = {
  totalUsd: number;
  dayChangeUsd: number | null;
  dayChangePercent: number | null;
  byChain: Record<string, number>;
  byType: Record<string, number>;
};

export type WalletPosition = {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  quantity: number | null;
  valueUsd: number;
  priceUsd: number | null;
  dayChangePercent: number | null;
  type: string;
  protocol: string | null;
  verified: boolean;
};

export type WalletSnapshot = {
  address: string;
  source: "zerion" | "demo";
  generatedAt: string;
  portfolio: WalletPortfolio;
  positions: WalletPosition[];
  notice?: string;
};

export type ChatResponse = {
  reply: string;
  wallet: WalletSnapshot;
  provider: "model" | "local";
};
