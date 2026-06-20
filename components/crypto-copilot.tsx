"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  Activity,
  ArrowDownUp,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSearch,
  Flame,
  Gauge,
  LineChart,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet,
  WalletCards
} from "lucide-react";
import { VerdictLogo } from "@/components/verdict-logo";
import { formatUsd, shortAddress } from "@/lib/format";

type Market = {
  id: string;
  question: string;
  category: string;
  source: string;
  closeLabel: string;
  yesProbability: number;
  liquidityUsd: number;
  volumeUsd: number;
  status: "open" | "forecasting" | "resolving";
  confidence: number;
  change: number;
};

const INITIAL_MARKETS: Market[] = [
  {
    id: "btc-100k",
    question: "Will BTC close above $100,000 this Friday?",
    category: "Crypto",
    source: "coinmarketcap.com",
    closeLabel: "Jun 26, 2026",
    yesProbability: 61,
    liquidityUsd: 84200,
    volumeUsd: 318000,
    status: "open",
    confidence: 72,
    change: 4.2
  },
  {
    id: "eth-etf",
    question: "Will weekly ETH ETF net inflows exceed $500M?",
    category: "Macro",
    source: "farside.co.uk",
    closeLabel: "Jun 27, 2026",
    yesProbability: 43,
    liquidityUsd: 37600,
    volumeUsd: 129500,
    status: "forecasting",
    confidence: 58,
    change: -2.1
  },
  {
    id: "fed-cut",
    question: "Will the Fed announce a rate cut at the next meeting?",
    category: "Rates",
    source: "federalreserve.gov",
    closeLabel: "Jul 29, 2026",
    yesProbability: 29,
    liquidityUsd: 126400,
    volumeUsd: 511000,
    status: "open",
    confidence: 81,
    change: 1.3
  }
];

const CATEGORY_OPTIONS = ["Crypto", "Macro", "Sports", "Politics", "Weather", "Culture"];

function newMarketId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function probabilityLabel(value: number) {
  return `${Math.round(value)}%`;
}

function sourceHost(raw: string) {
  try {
    return new URL(raw).host.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0] || "source pending";
  }
}

export function GenBetLMApp() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [markets, setMarkets] = useState<Market[]>(INITIAL_MARKETS);
  const [selectedId, setSelectedId] = useState(INITIAL_MARKETS[0].id);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState("250");
  const [question, setQuestion] = useState("Will SOL close above $180 before July 1?");
  const [category, setCategory] = useState("Crypto");
  const [source, setSource] = useState("https://coinmarketcap.com/currencies/solana/");
  const [deadline, setDeadline] = useState("2026-07-01");
  const [drafting, setDrafting] = useState(false);

  const activeWallet = useMemo(() => {
    const external = wallets.find((item) => item.walletClientType !== "privy");
    const embedded = wallets.find((item) => item.walletClientType === "privy");
    return external ?? embedded ?? wallets[0] ?? null;
  }, [wallets]);

  const address = activeWallet?.address;
  const selectedMarket = markets.find((market) => market.id === selectedId) ?? markets[0];
  const openMarkets = markets.filter((market) => market.status !== "resolving").length;
  const totalLiquidity = markets.reduce((total, market) => total + market.liquidityUsd, 0);
  const totalVolume = markets.reduce((total, market) => total + market.volumeUsd, 0);
  const walletReady = ready && walletsReady;

  function connect() {
    if (!authenticated) {
      login();
    }
  }

  function createMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    if (!authenticated) {
      login();
      return;
    }

    const id = newMarketId();
    const nextMarket: Market = {
      id,
      question: question.trim(),
      category,
      source: sourceHost(source.trim()),
      closeLabel: deadline || "Deadline pending",
      yesProbability: 52,
      liquidityUsd: 0,
      volumeUsd: 0,
      status: "forecasting",
      confidence: 49,
      change: 0
    };
    setMarkets((current) => [nextMarket, ...current]);
    setSelectedId(id);
  }

  function draftWithAi() {
    setDrafting(true);
    window.setTimeout(() => {
      setQuestion("Will SOL close above $180 before July 1, 2026?");
      setSource("https://coinmarketcap.com/currencies/solana/");
      setCategory("Crypto");
      setDeadline("2026-07-01");
      setDrafting(false);
    }, 600);
  }

  const selectedStake = Number(stake) || 0;
  const payoutMultiple =
    side === "yes"
      ? 100 / Math.max(selectedMarket.yesProbability, 1)
      : 100 / Math.max(100 - selectedMarket.yesProbability, 1);
  const estimatedReturn = selectedStake * payoutMultiple;

  return (
    <main className="product-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark">
            <VerdictLogo size={20} />
          </span>
          <div>
            <strong>GenBetLM</strong>
            <span>GenLayer-native prediction markets</span>
          </div>
        </div>

        <nav className="header-tabs" aria-label="Primary">
          <button className="header-tab active">Markets</button>
          <button className="header-tab">Forecasts</button>
          <button className="header-tab">Settlements</button>
        </nav>

        <div className="wallet-actions">
          {authenticated && address ? (
            <>
              <span className="network-pill">
                <ShieldCheck size={14} aria-hidden="true" />
                Studionet
              </span>
              <span className="wallet-pill" title={address}>
                <Wallet size={14} aria-hidden="true" />
                {shortAddress(address)}
              </span>
              <button className="icon-button" type="button" onClick={logout} aria-label="Disconnect">
                <LogOut size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button className="connect-wallet" type="button" onClick={connect} disabled={!walletReady}>
              {walletReady ? <WalletCards size={16} aria-hidden="true" /> : <Loader2 className="spin" size={16} />}
              Connect with Privy
            </button>
          )}
        </div>
      </header>

      <section className="kpi-strip" aria-label="Market overview">
        <div className="kpi-item">
          <Activity size={17} aria-hidden="true" />
          <span>Open Markets</span>
          <strong>{openMarkets}</strong>
        </div>
        <div className="kpi-item">
          <Gauge size={17} aria-hidden="true" />
          <span>Consensus Confidence</span>
          <strong>71%</strong>
        </div>
        <div className="kpi-item">
          <Flame size={17} aria-hidden="true" />
          <span>Liquidity</span>
          <strong>{formatUsd(totalLiquidity, true)}</strong>
        </div>
        <div className="kpi-item">
          <LineChart size={17} aria-hidden="true" />
          <span>Volume</span>
          <strong>{formatUsd(totalVolume, true)}</strong>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="market-builder" aria-labelledby="builder-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Market Composer</span>
              <h1 id="builder-title">Create a source-backed market</h1>
            </div>
            <button className="ai-button" type="button" onClick={draftWithAi} disabled={drafting}>
              {drafting ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
              Draft
            </button>
          </div>

          <form className="builder-form" onSubmit={createMarket}>
            <label>
              <span>Question</span>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} />
            </label>

            <div className="field-row">
              <label>
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Deadline</span>
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </label>
            </div>

            <label>
              <span>Resolution Source</span>
              <input value={source} onChange={(event) => setSource(event.target.value)} />
            </label>

            <button className="primary-action" type="submit">
              {authenticated ? <Plus size={16} /> : <Wallet size={16} />}
              {authenticated ? "Create Market" : "Connect to Create"}
            </button>
          </form>
        </section>

        <section className="market-board" aria-labelledby="markets-title">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">Order Book</span>
              <h2 id="markets-title">Live Markets</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Alerts">
              <Bell size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="market-list">
            {markets.map((market) => (
              <button
                key={market.id}
                type="button"
                className={`market-row ${market.id === selectedMarket.id ? "selected" : ""}`}
                onClick={() => setSelectedId(market.id)}
              >
                <span className="market-main">
                  <span className="market-question">{market.question}</span>
                  <span className="market-meta">
                    {market.category} / {market.source} / {market.closeLabel}
                  </span>
                </span>
                <span className="probability-cell">
                  <span className="probability-bar" aria-hidden="true">
                    <span style={{ width: `${market.yesProbability}%` }} />
                  </span>
                  <strong>{probabilityLabel(market.yesProbability)}</strong>
                </span>
                <span className={`change ${market.change >= 0 ? "up" : "down"}`}>
                  {market.change >= 0 ? "+" : ""}
                  {market.change.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="trade-panel" aria-labelledby="trade-title">
          <div className="trade-header">
            <span className="status-badge">
              <CheckCircle2 size={14} aria-hidden="true" />
              {selectedMarket.status}
            </span>
            <span className="confidence-badge">
              <Bot size={14} aria-hidden="true" />
              {selectedMarket.confidence}% confidence
            </span>
          </div>

          <h2 id="trade-title">{selectedMarket.question}</h2>

          <div className="source-line">
            <FileSearch size={15} aria-hidden="true" />
            {selectedMarket.source}
            <ExternalLink size={13} aria-hidden="true" />
          </div>

          <div className="market-depth">
            <div>
              <span>YES</span>
              <strong>{probabilityLabel(selectedMarket.yesProbability)}</strong>
            </div>
            <div>
              <span>NO</span>
              <strong>{probabilityLabel(100 - selectedMarket.yesProbability)}</strong>
            </div>
          </div>

          <div className="ticket">
            <div className="side-toggle" role="group" aria-label="Position side">
              <button
                type="button"
                className={side === "yes" ? "active yes" : ""}
                onClick={() => setSide("yes")}
              >
                YES
              </button>
              <button
                type="button"
                className={side === "no" ? "active no" : ""}
                onClick={() => setSide("no")}
              >
                NO
              </button>
            </div>

            <label className="stake-field">
              <span>Stake</span>
              <input
                inputMode="decimal"
                value={stake}
                onChange={(event) => setStake(event.target.value.replace(/[^\d.]/g, ""))}
              />
            </label>

            <dl className="ticket-summary">
              <div>
                <dt>Est. Return</dt>
                <dd>{formatUsd(estimatedReturn)}</dd>
              </div>
              <div>
                <dt>Liquidity</dt>
                <dd>{formatUsd(selectedMarket.liquidityUsd, true)}</dd>
              </div>
              <div>
                <dt>Resolution</dt>
                <dd>
                  <Clock3 size={13} aria-hidden="true" />
                  {selectedMarket.closeLabel}
                </dd>
              </div>
            </dl>

            <button className="primary-action full" type="button" onClick={connect}>
              {authenticated ? <ArrowDownUp size={16} /> : <Wallet size={16} />}
              {authenticated ? "Sign Position" : "Connect with Privy"}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
