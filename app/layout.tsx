import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Suspense } from "react"
import { OnchainKitProvider } from "@coinbase/onchainkit"
import { base } from "viem/chains"

export const metadata: Metadata = {
  title: "Treasure Hunt - Base Mini App",
  description: "Multiplayer treasure hunt game on Base blockchain",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <OnchainKitProvider
            apiKey="RapNJ0ankst9y4YwMY10XjQYlgvRUl24"
            chain={base}
            config={{
              appearance: {
                mode: "auto",
                theme: "base",
              },
            }}
          >
            {children}
          </OnchainKitProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
