import "./globals.css";
import type { Metadata, Viewport } from "next";

const desc = "天・地・人を、風がつなぐ。波動調整師のための、日々の波動調整を刻む手帖。千鈴龍穂の教えとともに。";

export const metadata: Metadata = {
  title: "ニライの手帖",
  description: desc,
  openGraph: { title: "ニライの手帖", description: desc, type: "website", locale: "ja_JP", siteName: "ニライの手帖" },
  appleWebApp: { capable: true, title: "ニライの手帖", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#eef5f6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
