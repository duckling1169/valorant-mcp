import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-display",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "VALORANT MCP",
  description:
    "Ask your AI about your matches. A self-hosted MCP server for VALORANT stats.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
