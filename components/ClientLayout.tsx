"use client";

import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import LoginForm from "./LoginForm";
import { useApp } from "@/context/AppContext";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useApp();

  // 未ログイン時はログイン画面を表示
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="flex h-screen bg-stone-950 font-sans text-stone-100 antialiased overflow-hidden">
      {/* サイドバー */}
      <Sidebar />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-stone-900/60">
        {/* ヘッダー */}
        <Header />

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto text-stone-100 relative">{children}</main>
      </div>
    </div>
  );
}
