import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdict — GenLayer crypto copilot",
  description:
    "Verdict is a crypto-native chatbot where every answer is settled by GenLayer validator consensus. Powered by Privy and Zerion."
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
