import "./globals.css";
import type { Metadata, Viewport } from "next";

const desc = "波動調整師 千鈴龍穂（senritatuho）が作る、旅と波動の記録手帖。海の彼方、ニライの風をたどる。";

export const metadata: Metadata = {
  title: "ニライの手帖｜波動調整師 千鈴龍穂",
  description: desc,
  authors: [{ name: "千鈴龍穂 (senritatuho)" }],
  creator: "千鈴龍穂",
  openGraph: { title: "ニライの手帖｜波動調整師 千鈴龍穂", description: desc, type: "website", locale: "ja_JP", siteName: "ニライの手帖" },
  appleWebApp: { capable: true, title: "ニライの手帖", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#d6eef0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
