"use client";

import React, { useState } from "react";
import { User, KeyRound, AlertCircle, ArrowRight, Eye, EyeOff, Shield } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getThemeStyles } from "@/lib/theme";
import { cn } from "@/lib/utils";

export default function LoginForm() {
  const { login, siteBranding } = useApp();
  const theme = getThemeStyles(siteBranding.themeColor);
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !pass.trim()) {
      setError("名前とパスワードを入力してください。");
      return;
    }

    setIsLoading(true);
    const result = login(username, pass);
    if (!result.success) {
      setError(result.message || "ログインに失敗しました。ユーザー名またはパスワードをご確認ください。");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950 p-4">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-stone-700 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-stone-700 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl p-8 text-white">
        {/* ロゴ & 正式版タイトル */}
        <div className="text-center mb-6">
          <div className={`w-24 h-24 rounded-full bg-stone-900 border-2 ${theme.accentBorder} p-2 flex items-center justify-center mx-auto mb-3 shadow-xl overflow-hidden`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siteBranding.logoUrl || "/logo.png"} alt={siteBranding.siteName} className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{siteBranding.siteName}</h1>
          <p className="text-xs text-stone-400 mt-1">{siteBranding.siteSubtitle || "店舗管理・売上クラフトシステム (正式運用版)"}</p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 認証フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stone-400" />
              従業員名 (ユーザー名)
            </label>
            <input
              type="text"
              placeholder="ユーザー名を入力"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                "w-full bg-stone-800/80 border border-stone-700 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none transition-all font-medium",
                theme.focusRing
              )}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-stone-400" />
              ログインPASS (パスワード)
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="パスワードを入力"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={cn(
                  "w-full bg-stone-800/80 border border-stone-700 rounded-xl pl-4 pr-11 py-3 text-sm text-white placeholder-stone-500 focus:outline-none transition-all font-medium tracking-wider",
                  theme.focusRing
                )}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition-colors p-1"
                tabIndex={-1}
                title={showPass ? "パスワードを隠す" : "パスワードを表示する"}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-3.5 rounded-xl active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-4",
              theme.loginBtn
            )}
          >
            <span>{isLoading ? "認証中..." : "店舗システムにログイン"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* セキュリティ表記 */}
        <div className="mt-6 pt-4 border-t border-stone-800/60 text-center">
          <p className="text-[10px] text-stone-500 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3 text-stone-600" />
            <span>関係者専用システム ｜ 権限は幹部管理画面にて発行されます</span>
          </p>
        </div>
      </div>
    </div>
  );
}
