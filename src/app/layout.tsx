import type { Metadata } from "next";
import { Noto_Sans_JP, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const fontNoto = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const fontInter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wayfinder AgriX Drone - ドローンあいのり予約",
  description: "Wayfinder AgriX Drone - 農家と業者をつなぐ農作業予約プラットフォーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${fontInter.variable} ${fontNoto.variable} font-sans antialiased tracking-tight`}
      >
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
