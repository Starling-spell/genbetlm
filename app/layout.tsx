import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenBetLM - Web3 prediction markets",
  description:
    "GenBetLM is a Privy-connected Web3 prediction market product powered by GenLayer-native market drafting, forecasting, and settlement."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
