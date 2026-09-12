"use client";

import React, { useState } from "react";
import { Lock, User, KeyRound, AlertCircle, Store, ArrowRight, ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function LoginForm() {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !pass.trim()) {
      setError("名前とPASSを入力してください。");
      return;
    }

    const result = login(username, pass);
    if (!result.success) {
      setError(result.message || "ログインに失敗しました。");
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPass(p);
    login(u, p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950 p-4">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-rose-600 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-amber-600 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl p-8 text-white">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 rounded-full bg-stone-900 border-2 border-amber-400/40 p-2 flex items-center justify-center mx-auto mb-3 shadow-xl shadow-rose-950/50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="和食さくら" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">和食さくら</h1>
          <p className="text-xs text-stone-400 mt-1">店舗管理・売上クラフトシステム</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stone-400" />
              名前 (ユーザーID)
            </label>
            <input
              type="text"
              placeholder="例: kein"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-stone-800/80 border border-stone-700 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
              PASS (パスワード)
            </label>
            <input
              type="password"
              placeholder="例: 001"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full bg-stone-800/80 border border-stone-700 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-medium tracking-widest"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 font-bold text-sm text-white shadow-lg shadow-rose-900/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>店舗システムに入る</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* クイックログイン案内（テスト用） */}
        <div className="mt-6 pt-5 border-t border-stone-800/80">
          <p className="text-[11px] text-stone-400 text-center mb-2 font-medium">
            クイックログイン (ワンタップ):
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => handleQuickLogin("kein", "001")}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-amber-400 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              管理者: kein (001)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("yamada", "123")}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-medium text-stone-300 transition-colors"
            >
              スタッフ: yamada (123)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
