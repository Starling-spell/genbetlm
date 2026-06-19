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
    // Adds + switches the wallet (Privy) to the GenLayer chain. Must run before
    // writing or the SDK throws a wrong-chain error.
    onPhase?.("connecting");
    await client.connect(network as never);

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

    return {
      txHash: String(txHash),
      answer: typeof answer === "string" ? answer : String(answer ?? ""),
      network
    };
  } catch (error) {
    throw new Error(humanizeGenLayerError(error));
  }
}

function humanizeGenLayerError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction rejected in your wallet.";
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient balance")) {
    return "Your wallet has no GEN to pay for this transaction. Fund it from the GenLayer Studio faucet and try again.";
  }
  if (lower.includes("chain") && lower.includes("expect")) {
    return "Your wallet is on the wrong network. Approve the network switch to GenLayer and retry.";
  }
  return message || "GenLayer transaction failed.";
}
