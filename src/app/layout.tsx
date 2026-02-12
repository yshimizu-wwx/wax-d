import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Toaster } from "sonner";

const fontSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wayfinder AgriX - ドローンあいのり予約",
  description: "農家と業者をつなぐ農作業予約プラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${fontSans.variable} ${fontMono.variable} antialiased`}
      >
        <Header />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
