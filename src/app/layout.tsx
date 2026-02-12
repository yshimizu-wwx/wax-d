import type { Metadata } from "next";
import { Noto_Sans_JP, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Toaster } from "sonner";

/** 本文・UI 用: 計画書「Noto Sans JP を主軸」 */
const fontNoto = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

/** 数字・データ表示用: 計画書「数字には Inter」 */
const fontInter = Inter({
  variable: "--font-inter",
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
        className={`${fontNoto.variable} ${fontInter.variable} font-sans antialiased`}
      >
        <Header />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
