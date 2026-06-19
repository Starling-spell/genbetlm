// Deploys contracts/chatbot.py to a GenLayer network.
//
// Usage:
//   GENLAYER_NETWORK=studionet GENLAYER_PRIVATE_KEY=0x... npm run deploy:contract
//
// - GENLAYER_NETWORK: studionet (default) | testnetAsimov | testnetBradbury | localnet
// - GENLAYER_PRIVATE_KEY: optional. If omitted a throwaway account is generated;
//   it must hold GEN on the target network to pay for deployment gas.
//
// After it prints the contract address, set it in your env as
// NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS.
import fs from "node:fs";
import path from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const chains = { localnet, studionet, testnetAsimov, testnetBradbury } as const;
type ChainName = keyof typeof chains;

const network = (process.env.GENLAYER_NETWORK || "studionet") as ChainName;
const privateKey = process.env.GENLAYER_PRIVATE_KEY as `0x${string}` | undefined;

if (!chains[network]) {
  throw new Error(
    `Unsupported GENLAYER_NETWORK: ${network}. Use one of: ${Object.keys(chains).join(", ")}`
  );
}

const account = privateKey ? createAccount(privateKey) : createAccount();
const client = createClient({ chain: chains[network], account });

const code = fs.readFileSync(path.resolve(process.cwd(), "contracts/chatbot.py"), "utf8");

console.log(`Deploying contracts/chatbot.py to ${network} as ${account.address} ...`);

const txHash = await client.deployContract({ account, code, args: [] });
console.log(`Deploy transaction: ${txHash}`);

const receipt = (await client.waitForTransactionReceipt({
  hash: txHash as never,
  status: TransactionStatus.ACCEPTED
})) as Record<string, unknown>;

const data = receipt.data as { contract_address?: string } | undefined;
const decoded = receipt.txDataDecoded as { contractAddress?: string } | undefined;
const contractAddress = data?.contract_address ?? decoded?.contractAddress;

if (contractAddress) {
  console.log(`\n✅ Deployed. Set this in your env:\n`);
  console.log(`NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`NEXT_PUBLIC_GENLAYER_NETWORK=${network}\n`);
} else {
  console.log("Deployed, but could not auto-read the address. Full receipt:");
  console.log(JSON.stringify(receipt, null, 2));
}
