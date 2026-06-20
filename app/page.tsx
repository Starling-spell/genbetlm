import { MissingSetup } from "@/components/missing-setup";
import { GenBetLMApp } from "@/components/crypto-copilot";

export default function Home() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return <MissingSetup />;
  }

  return <GenBetLMApp />;
}
