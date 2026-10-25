import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import AppBoot from "@/components/AppBoot";
import "./globals.css";
import "@/lib/env"; // side-effect: validate env at app boot

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeekChat",
  description: "프라이버시 우선 메신저 — 개발자 친화적 채팅",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render every page per request: the CSP nonce from src/proxy.ts can only be
  // stamped on Next's scripts at request time (RULES.md R5).
  await connection();
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppBoot />
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
