"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { genLayerStudionet } from "@/lib/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ["email", "wallet", "google"],
        // Register GenLayer studionet so the wallet can switch to chain 61999
        // when each chat message is sent as a GenLayer transaction.
        defaultChain: genLayerStudionet,
        supportedChains: [genLayerStudionet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          }
        },
        appearance: {
          theme: "dark",
          accentColor: "#22d3a6",
          walletChainType: "ethereum-only"
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
