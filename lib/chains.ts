import { defineChain } from "viem";

// GenLayer Studio network (studionet), mirrored as a viem chain so Privy can add
// and switch the user's wallet to it. Values match genlayer-js `studionet`
// (chain id 61999) so genlayer-js `client.connect("studionet")` is a no-op switch.
export const genLayerStudionet = defineChain({
  id: 61999,
  name: "GenLayer Studio Network",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://studio.genlayer.com/api"] }
  },
  blockExplorers: {
    default: {
      name: "GenLayer Studio Explorer",
      url: "https://explorer-studio.genlayer.com"
    }
  },
  testnet: true
});
