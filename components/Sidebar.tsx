"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  Boxes,
  ShieldCheck,
  Store,
  LogOut,
  ChevronRight,
  Sparkles,
  Receipt,
  Image as ImageIcon,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, logout } = useApp();

  const isExecutive = currentUser?.role === "executive";

  const navItems = [
    {
      name: "売上 ＆ クラフト作成",
      href: "/",
      icon: ShoppingBag,
      desc: "商品の販売と料理作成",
    },
    {
      name: "売上管理・台帳",
      href: "/sales",
      icon: Receipt,
      desc: "伝票一覧・売上ランキング・取消",
    },
    {
      name: "全体在庫一覧",
      href: "/inventory",
      icon: Boxes,
      desc: "商品・素材の全在庫",
    },
    {
      name: "幹部管理ページ",
      href: "/executive",
      icon: ShieldCheck,
      desc: "従業員PASS/給与査定/金庫",
      isExecutiveOnly: true,
    },
  ];

  return (
    <aside className="w-64 bg-stone-900 text-stone-100 flex flex-col border-r border-stone-800 shadow-2xl shrink-0">
      {/* 店舗ヘッダー */}
      <div className="p-5 border-b border-stone-800 bg-stone-950/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 border border-amber-400/40 p-1 flex items-center justify-center shadow-lg shadow-rose-950/40 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="和食さくら" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-wide text-white">和食さくら</span>
            </div>
            <p className="text-[11px] text-stone-400">店舗売上・クラフト管理</p>
          </div>
        </div>
      </div>

      {/* ナビゲーションメニュー */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          店舗メニュー
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isLocked = item.isExecutiveOnly && !isExecutive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition-all duration-200 border",
                isActive
                  ? "bg-rose-600/90 text-white border-rose-500 shadow-md shadow-rose-900/40"
                  : "bg-stone-800/40 text-stone-300 border-stone-800/60 hover:bg-stone-800 hover:text-white hover:border-stone-700",
                isLocked && !isActive && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : item.isExecutiveOnly
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-stone-700/50 text-stone-400"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.isExecutiveOnly && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        幹部
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">{item.desc}</p>
                </div>
              </div>

              <ChevronRight
                className={cn(
                  "w-4 h-4 text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity",
                  isActive && "opacity-100 text-white"
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* ログインユーザー情報 & ログアウト */}
      <div className="p-4 border-t border-stone-800 bg-stone-950/70">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center font-bold text-sm text-white shrink-0">
              {currentUser?.displayName.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser?.displayName}</p>
              <div className="flex items-center gap-1 text-[10px] mt-0.5">
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded font-bold",
                    isExecutive
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                      : "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                  )}
                >
                  {isExecutive ? "幹部管理者" : "一般スタッフ"}
                </span>
                <span className="text-stone-500 font-mono">(@{currentUser?.username})</span>
              </div>
            </div>
          </div>

          {/* ログアウトボタン */}
          <button
            type="button"
            onClick={logout}
            title="ログアウト"
            className="p-2 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-stone-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
