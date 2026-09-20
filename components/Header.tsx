"use client";

import React, { useState, useEffect } from "react";
import { Clock, LogOut, User } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getThemeStyles } from "@/lib/theme";

export default function Header() {
  const { currentUser, logout, syncStatus, siteBranding } = useApp();
  const [timeString, setTimeString] = useState<string>("");
  const theme = getThemeStyles(siteBranding.themeColor);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 bg-stone-900 border-b border-stone-800 px-4 sm:px-6 flex items-center justify-between shadow-sm shrink-0">
      {/* 左側: 店舗ステータス & ロゴ */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-stone-800 border ${theme.accentBorder} p-0.5 flex items-center justify-center overflow-hidden shadow-xs`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siteBranding.logoUrl || "/logo.png"} alt={siteBranding.siteName} className="w-full h-full object-contain" />
          </div>
          <span className="font-extrabold text-stone-200 hidden sm:inline">{siteBranding.siteName}</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-medium bg-stone-800/80 px-3 py-1 rounded-lg border border-stone-700/60 text-stone-300">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span suppressHydrationWarning>{timeString || "22:00:00"}</span>
        </div>

        {/* リアルタイム同期ステータス */}
        {syncStatus === "connected" && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>リアルタイム同期中</span>
          </div>
        )}
        {syncStatus === "syncing" && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>接続同期中...</span>
          </div>
        )}
        {syncStatus === "offline" && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400 bg-stone-800/80 px-2.5 py-1 rounded-lg border border-stone-700">
            <span className="w-2 h-2 rounded-full bg-stone-500" />
            <span>ローカル稼働</span>
          </div>
        )}
      </div>

      {/* 右側: ログイン中の担当者 & ログアウト */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700">
          <User className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-stone-400">操作担当:</span>
          <strong className="text-white font-bold">{currentUser?.displayName}</strong>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
              currentUser?.role === "executive"
                ? theme.accentBadge
                : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
            }`}
          >
            {currentUser?.role === "executive" ? "幹部" : "スタッフ"}
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-rose-950/40 text-stone-300 hover:text-rose-400 border border-stone-700 transition-colors font-medium text-xs cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          ログアウト
        </button>
      </div>
    </header>
  );
}
