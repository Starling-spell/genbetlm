import { FileSearch, GitBranch, ShieldCheck, WalletCards } from "lucide-react";
import { VerdictLogo } from "@/components/verdict-logo";

export function MissingSetup() {
  return (
    <main className="empty-state">
      <section className="setup-panel">
        <span className="elsa-kicker">
          <VerdictLogo size={15} />
          GENBETLM / PRIVY CONNECT
        </span>
        <h1>GenBetLM Web3 market workspace</h1>
        <p>
          Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code> locally or in Vercel to enable Privy wallet
          login, embedded wallets, market creation, and signed Web3 actions.
        </p>
        <div className="setup-grid">
          <div className="setup-item">
            <WalletCards size={18} aria-hidden="true" />
            <strong>Privy Wallet</strong>
            <span>Email, Google, external wallets, and embedded EVM wallets.</span>
          </div>
          <div className="setup-item">
            <FileSearch size={18} aria-hidden="true" />
            <strong>Market Sources</strong>
            <span>Public URLs back each market draft, forecast, and settlement.</span>
          </div>
          <div className="setup-item">
            <ShieldCheck size={18} aria-hidden="true" />
            <strong>GenBetLM</strong>
            <span>An Intelligent Contract drafts, forecasts, and resolves markets.</span>
          </div>
          <div className="setup-item">
            <GitBranch size={18} aria-hidden="true" />
            <strong>GitHub Deploy</strong>
            <span>Push, import in Vercel, add env vars, and ship.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
