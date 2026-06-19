"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  ArrowUp,
  Bot,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { VerdictLogo } from "@/components/verdict-logo";
import { askGenLayer, getGenLayerConfig, type AskGenLayerPhase } from "@/lib/genlayer-client";
import { formatUsd, shortAddress } from "@/lib/format";
import type { WalletSnapshot } from "@/lib/types";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  phase?: AskGenLayerPhase;
  txHash?: string;
  error?: boolean;
};

const PHASE_LABEL: Record<AskGenLayerPhase, string> = {
  connecting: "Switching your wallet to GenLayer…",
  approving: "Approve the transaction in your wallet…",
  consensus: "Running GenLayer consensus…"
};

const EXAMPLES = [
  "Summarize my portfolio and its biggest risks",
  "Which position am I most concentrated in?",
  "What should I check before bridging to Base?",
  "Explain the risks of my DeFi positions"
];

const EXPLORER_URL = "https://explorer-studio.genlayer.com";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

// Compact, on-chain-friendly portfolio context passed into every GenLayer tx.
function buildContext(wallet: WalletSnapshot | null): string {
  if (!wallet) {
    return JSON.stringify({ note: "No wallet portfolio data available yet." });
  }
  const topPositions = wallet.positions.slice(0, 8).map((position) => ({
    symbol: position.symbol,
    chain: position.chain,
    value_usd: Math.round(position.valueUsd),
    type: position.type,
    protocol: position.protocol
  }));
  return JSON.stringify({
    address: wallet.address,
    source: wallet.source,
    total_usd: Math.round(wallet.portfolio.totalUsd),
    day_change_percent: wallet.portfolio.dayChangePercent,
    chains: wallet.portfolio.byChain,
    top_positions: topPositions
  });
}

export function CryptoCopilot() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeWallet = useMemo(
    () => wallets.find((item) => item.walletClientType === "privy") ?? wallets[0] ?? null,
    [wallets]
  );
  const address = activeWallet?.address as `0x${string}` | undefined;
  const { contractAddress } = getGenLayerConfig();
  const configured = Boolean(contractAddress);

  const loadWallet = useCallback(async () => {
    if (!address) return;
    setLoadingWallet(true);
    try {
      const response = await fetch(`/api/wallet/${address}`);
      const data = (await response.json()) as { wallet?: WalletSnapshot };
      if (response.ok && data.wallet) {
        setWallet(data.wallet);
      }
    } catch {
      // Non-fatal: the chat still works, the contract just gets an empty context.
    } finally {
      setLoadingWallet(false);
    }
  }, [address]);

  useEffect(() => {
    if (ready && authenticated && walletsReady && address) {
      void loadWallet();
    }
  }, [ready, authenticated, walletsReady, address, loadWallet]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function patch(id: string, next: Partial<UiMessage>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...next } : message))
    );
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;

    if (!authenticated || !address || !activeWallet) {
      login();
      return;
    }

    const userMessage: UiMessage = { id: newId(), role: "user", content };
    const pendingId = newId();
    const pendingMessage: UiMessage = {
      id: pendingId,
      role: "assistant",
      content: "",
      pending: true,
      phase: "connecting"
    };

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setInput("");

    if (!configured) {
      patch(pendingId, {
        pending: false,
        error: true,
        content:
          "GenLayer contract address is not set. Deploy contracts/chatbot.py to studionet and set NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS."
      });
      return;
    }

    setBusy(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      const result = await askGenLayer({
        address,
        provider,
        question: content,
        context: buildContext(wallet),
        onPhase: (phase) => patch(pendingId, { phase })
      });
      patch(pendingId, {
        pending: false,
        content: result.answer || "(GenLayer returned an empty answer)",
        txHash: result.txHash
      });
      void loadWallet();
    } catch (error) {
      patch(pendingId, {
        pending: false,
        error: true,
        content: error instanceof Error ? error.message : "GenLayer transaction failed."
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  const empty = messages.length === 0;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-orb">
            <VerdictLogo size={18} />
          </span>
          <div className="brand-text">
            <strong>Verdict</strong>
            <span>GenLayer crypto copilot</span>
          </div>
        </div>

        <div className="topbar-actions">
          {wallet ? (
            <button
              className="ghost-chip"
              onClick={loadWallet}
              disabled={loadingWallet}
              title="Refresh portfolio"
            >
              {loadingWallet ? (
                <Loader2 className="spin" size={14} aria-hidden="true" />
              ) : (
                <RefreshCw size={14} aria-hidden="true" />
              )}
              {formatUsd(wallet.portfolio.totalUsd, true)}
            </button>
          ) : null}

          {authenticated && address ? (
            <div className="wallet-group">
              <span className="wallet-chip" title={address}>
                <Wallet size={14} aria-hidden="true" />
                {shortAddress(address)}
              </span>
              <button className="icon-btn" onClick={logout} title="Disconnect" aria-label="Disconnect">
                <LogOut size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button className="connect-btn" onClick={login} disabled={!ready}>
              <Wallet size={15} aria-hidden="true" />
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <section className="conversation">
        {empty ? (
          <div className="welcome">
            <div className="welcome-orb">
              <VerdictLogo size={30} />
            </div>
            <h1>Crypto answers, settled by GenLayer</h1>
            <p>
              Connect your wallet and ask anything about your portfolio. Every message is a GenLayer
              transaction you approve in your wallet — the answer comes from validator consensus, not
              a single server.
            </p>
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button key={example} className="example" onClick={() => void send(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <article key={message.id} className={`msg ${message.role}`}>
                <div className="avatar">
                  {message.role === "assistant" ? (
                    <Bot size={16} aria-hidden="true" />
                  ) : (
                    <Wallet size={16} aria-hidden="true" />
                  )}
                </div>
                <div className="bubble-wrap">
                  {message.pending ? (
                    <div className="bubble status">
                      <Loader2 className="spin" size={15} aria-hidden="true" />
                      {PHASE_LABEL[message.phase ?? "connecting"]}
                    </div>
                  ) : (
                    <div className={`bubble ${message.error ? "error" : ""}`}>{message.content}</div>
                  )}
                  {message.txHash ? (
                    <a
                      className="tx-link"
                      href={`${EXPLORER_URL}/tx/${message.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ShieldCheck size={13} aria-hidden="true" />
                      GenLayer tx {shortAddress(message.txHash)}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </section>

      <footer className="composer-wrap">
        <form className="composer" onSubmit={onSubmit}>
          <textarea
            rows={1}
            value={input}
            placeholder={
              authenticated ? "Ask Verdict about your portfolio…" : "Connect your wallet to start…"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={busy}
          />
          <button className="send-btn" disabled={busy || !input.trim()} aria-label="Send">
            {busy ? (
              <Loader2 className="spin" size={17} aria-hidden="true" />
            ) : (
              <ArrowUp size={17} aria-hidden="true" />
            )}
          </button>
        </form>
        <p className="composer-note">
          Each message is signed as a GenLayer transaction on studionet. Keep some test GEN in your
          wallet for gas.
        </p>
      </footer>
    </main>
  );
}
