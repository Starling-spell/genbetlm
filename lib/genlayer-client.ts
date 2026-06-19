// Thin wrapper around genlayer-js for the one operation this app needs:
// turn a chat message into a consensus-backed answer from the Intelligent
// Contract. Every call is a wallet-signed GenLayer transaction.

export type AskGenLayerPhase = "connecting" | "approving" | "consensus";

type AskGenLayerParams = {
  address: `0x${string}`;
  // EIP-1193 provider from Privy (`wallet.getEthereumProvider()`).
  provider: unknown;
  question: string;
  context: string;
  // Reports progress so the UI can explain the wallet popup vs the consensus wait.
  onPhase?: (phase: AskGenLayerPhase) => void;
};

export type AskGenLayerResult = {
  txHash: string;
  answer: string;
  network: string;
};

const MAX_QUESTION = 1200;
const MAX_CONTEXT = 6000;

export function getGenLayerConfig() {
  const contractAddress = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as
    | `0x${string}`
    | undefined;
  const network = process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "studionet";
  return { contractAddress, network };
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

// Reads the caller's on-chain conversation memory. Read-only: no wallet, no gas.
export async function getOnChainHistory(address: string): Promise<ChatTurn[]> {
  const { contractAddress, network } = getGenLayerConfig();
  if (!contractAddress) return [];

  const [{ createClient }, chains] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains")
  ]);
  const chain = (chains as Record<string, unknown>)[network];
  if (!chain) return [];

  try {
    const client = createClient({ chain: chain as never });
    const raw = await client.readContract({
      address: contractAddress,
      functionName: "get_history",
      args: [address]
    });
    const parsed = JSON.parse(typeof raw === "string" ? raw : "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (turn): turn is ChatTurn =>
        !!turn &&
        typeof turn === "object" &&
        ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
        typeof (turn as ChatTurn).content === "string"
    );
  } catch {
    return [];
  }
}

export async function askGenLayer({
  address,
  provider,
  question,
  context,
  onPhase
}: AskGenLayerParams): Promise<AskGenLayerResult> {
  const { contractAddress, network } = getGenLayerConfig();

  if (!contractAddress) {
    throw new Error(
      "GenLayer contract is not configured. Set NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS."
    );
  }

  const [{ createClient }, chains, types] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
    import("genlayer-js/types")
  ]);

  const chain = (chains as Record<string, unknown>)[network];
  if (!chain) {
    throw new Error(`Unsupported GenLayer network: ${network}`);
  }

  const client = createClient({
    chain: chain as never,
    account: address,
    provider: provider as never
  });

  try {
    // Switch the wallet to the GenLayer chain ourselves (plain EVM switch) rather
    // than client.connect(), which forces a MetaMask Snap that Privy/non-MetaMask
    // wallets don't support. Must run before writing or the SDK throws wrong-chain.
    onPhase?.("connecting");
    await ensureWalletChain(provider, chain);

    // The write is signed by the user's wallet — Privy shows an approval popup.
    onPhase?.("approving");
    const txHash = await client.writeContract({
      address: contractAddress,
      functionName: "ask",
      args: [question.slice(0, MAX_QUESTION), context.slice(0, MAX_CONTEXT)],
      value: BigInt(0)
    });

    onPhase?.("consensus");
    const acceptedStatus =
      (types as { TransactionStatus?: { ACCEPTED?: unknown } }).TransactionStatus
        ?.ACCEPTED ?? "ACCEPTED";

    await client.waitForTransactionReceipt({
      hash: txHash as never,
      status: acceptedStatus as never
    });

    const answer = await client.readContract({
      address: contractAddress,
      functionName: "get_last_answer",
      args: [address]
    });

    // get_last_answer returns a str, but never let a non-string render as
    // "[object Object]".
    let answerText = "";
    if (typeof answer === "string") {
      answerText = answer;
    } else if (answer != null) {
      try {
        answerText = JSON.stringify(answer);
      } catch {
        answerText = "";
      }
    }

    return { txHash: String(txHash), answer: answerText, network };
  } catch (error) {
    throw new Error(humanizeGenLayerError(error));
  }
}

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

// Switch the wallet to the GenLayer chain with a plain EVM chain switch.
// We do NOT use genlayer-js `client.connect()` because it unconditionally calls
// `wallet_getSnaps`/`wallet_requestSnaps` (a MetaMask Snap), which Privy embedded
// wallets and non-MetaMask wallets don't implement ("wallet_getSnaps doesn't have
// a corresponding handler"). The actual transaction is a normal eth_sendTransaction,
// so a standard chain switch is all that's needed.
async function ensureWalletChain(provider: unknown, chain: unknown): Promise<void> {
  const eth = provider as Eip1193 | null;
  const c = chain as {
    id: number;
    name: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: { default: { http: readonly string[] } };
    blockExplorers?: { default: { url: string } };
  };
  if (!eth?.request) return;

  const chainIdHex = `0x${c.id.toString(16)}`;
  try {
    if ((await eth.request({ method: "eth_chainId" })) === chainIdHex) return;
  } catch {
    // ignore and try to switch
  }

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  } catch (error) {
    // 4902 = chain not added yet; some wallets surface -32603. Add then switch.
    const code = (error as { code?: number })?.code;
    if (code === 4902 || code === -32603 || code === undefined) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: c.name,
            rpcUrls: c.rpcUrls.default.http,
            nativeCurrency: c.nativeCurrency,
            blockExplorerUrls: c.blockExplorers ? [c.blockExplorers.default.url] : []
          }
        ]
      });
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }]
      });
    } else {
      throw error;
    }
  }
}

// Wallet/RPC/genlayer errors are often plain objects ({ code, message, ... }),
// so `String(error)` yields "[object Object]". Dig out the real message.
function extractErrorMessage(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const nested = (e.error ?? e.data ?? e.cause) as Record<string, unknown> | undefined;
    const candidates = [
      e.shortMessage,
      e.details,
      e.reason,
      e.message,
      nested?.message,
      nested?.shortMessage
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    if (e.cause && e.cause !== error) {
      const causeMessage = extractErrorMessage(e.cause);
      if (causeMessage) return causeMessage;
    }
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}" && json !== "[]") return json;
    } catch {
      // circular — fall through
    }
  }
  return String(error);
}

function humanizeGenLayerError(error: unknown): string {
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request")
  ) {
    return "Transaction rejected in your wallet.";
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient gen") ||
    lower.includes("not enough")
  ) {
    return "This wallet has no studionet GEN to pay for gas. Fund the connected address from the GenLayer Studio faucet, then try again.";
  }
  if (
    lower.includes("unrecognized chain") ||
    lower.includes("wrong network") ||
    (lower.includes("chain") && (lower.includes("expect") || lower.includes("mismatch")))
  ) {
    return "Your wallet isn't on the GenLayer network. Approve the network switch and retry.";
  }
  return message || "GenLayer transaction failed.";
}
