import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "和食さくら - 店舗管理・売上クラフトシステム (正式版)",
  description: "店舗運営・リアルタイム在庫・売上伝票・給与ボーナス管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased selection:bg-rose-500 selection:text-white">
        <AppProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppProvider>
      </body>
    </html>
  );
}
