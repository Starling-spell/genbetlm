import { GitBranch, KeyRound, ShieldCheck, WalletCards } from "lucide-react";
import { VerdictLogo } from "@/components/verdict-logo";

export function MissingSetup() {
  return (
    <main className="empty-state">
      <section className="setup-panel">
        <span className="elsa-kicker">
          <VerdictLogo size={15} />
          VERDICT · GenLayer Copilot
        </span>
        <h1>Welcome to Verdict — crypto answers settled by GenLayer</h1>
        <p>
          Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code> locally or in Vercel to enable the Privy wallet
          login, embedded wallets, and chat. Each message is a GenLayer transaction the user approves
          in their wallet; the Zerion key stays server-side so the GitHub repo is safe to deploy.
        </p>
        <div className="setup-grid">
          <div className="setup-item">
            <WalletCards size={18} aria-hidden="true" />
            <strong>Privy Wallet</strong>
            <span>Email, Google, or external wallets — with an embedded EVM wallet to sign with.</span>
          </div>
          <div className="setup-item">
            <KeyRound size={18} aria-hidden="true" />
            <strong>Zerion API</strong>
            <span>Server env var powers the live portfolio context for each question.</span>
          </div>
          <div className="setup-item">
            <ShieldCheck size={18} aria-hidden="true" />
            <strong>GenLayer brain</strong>
            <span>An Intelligent Contract answers under validator consensus, one tx per message.</span>
          </div>
          <div className="setup-item">
            <GitBranch size={18} aria-hidden="true" />
            <strong>Vercel</strong>
            <span>Push to GitHub, import in Vercel, add env vars, deploy.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
