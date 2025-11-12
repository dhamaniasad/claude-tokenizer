import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react"

import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Claude Tokenizer",
  description: "A Tokenizer for Claude models including Claude Sonnet 4.5, Opus 4.1, Haiku 4.5, and more. Count tokens for text, PDFs, and images.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://plausible.io/js/pa-auN1ZdnQVpBz7zZBKuANv.js"
        />
        <Script id="plausible-init">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
