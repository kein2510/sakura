"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Search,
  Utensils,
  Award,
  Radio,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  User,
  Crown,
  CalendarDays,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ShopId } from "@/types";
import { supabase } from "@/lib/supabase";
import { getSunday, getSaturday } from "@/lib/dateUtils";

type PeriodType = "today" | "week" | "month" | "all" | "custom";

export default function SalesPage() {
  const { sales, items, users, refreshData, cancelSale, shops, siteBranding } = useApp();

  // 期間フィルター ("today" | "week" | "month" | "all" | "custom")
  const [periodType, setPeriodType] = useState<PeriodType>("today");
  
  // 今日の日付 (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // 伝票リスト用フィルター
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>("all");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 通知ステート
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Supabase Realtime サブスクリプション
  useEffect(() => {
    const channel = supabase
      .channel("sales_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_sales" },
        (payload) => {
          refreshData();
          if (payload.eventType === "INSERT") {
            const row = payload.new as { staff_name?: string; total_amount?: number };
            setRealtimeNotice(`【売上同期】${row.staff_name || "スタッフ"}が売上 ¥${Number(row.total_amount).toLocaleString()} を登録しました！`);
          } else if (payload.eventType === "DELETE") {
            setRealtimeNotice("【伝票同期】売上伝票の取り消し・削除が同期されました");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // 売上伝票の取り消し実行（在庫復元 ＆ 金庫7割入金分のロールバック）
  const handleCancelSale = async (saleId: string, amount: number) => {
    if (
      window.confirm(
        `この売上伝票を取り消しますか？\n伝票番号: #${saleId}\n売上金額: ${formatCurrency(amount)}\n\n【取り消し処理内容】\n・販売された商品の在庫が元の個数に戻ります\n・金庫に入金された売上金（店舗取り分70%）が自動で戻されます`
      )
    ) {
      const res = await cancelSale(saleId);
      if (res.success) {
        setActionNotice({ type: "success", message: res.message });
      } else {
        setActionNotice({ type: "error", message: res.message });
      }
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  // ============================================================================
  // ① 期間フィルターに基づく売上伝票の抽出
  // ============================================================================
  const periodFilteredSales = useMemo(() => {
    const now = new Date();
    let startMs = 0;
    let endMs = Infinity;

    if (periodType === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startMs = todayStart.getTime();
      endMs = todayEnd.getTime();
    } else if (periodType === "week") {
      const sun = getSunday(now);
      const sat = getSaturday(now);
      startMs = sun.getTime();
      endMs = sat.getTime();
    } else if (periodType === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      startMs = monthStart.getTime();
      endMs = monthEnd.getTime();
    } else if (periodType === "custom") {
      if (customStart) {
        const s = new Date(customStart + "T00:00:00");
        if (!isNaN(s.getTime())) startMs = s.getTime();
      }
      if (customEnd) {
        const e = new Date(customEnd + "T23:59:59.999");
        if (!isNaN(e.getTime())) endMs = e.getTime();
      }
    }

    return sales.filter((s) => {
      const saleTime = new Date(s.created_at).getTime();
      return saleTime >= startMs && saleTime <= endMs;
    });
  }, [sales, periodType, customStart, customEnd]);

  // ============================================================================
  // ② 期間内の集計（売上合計、店舗別内訳、客単価、販売点数）
  // ============================================================================
  const periodStats = useMemo(() => {
    const totalAmount = periodFilteredSales.reduce(
      (sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0),
      0
    );
    const count = periodFilteredSales.length;
    const avgOrder = count > 0 ? Math.round(totalAmount / count) : 0;

    const sakuraSales = periodFilteredSales.filter((s) => (s.shopId || "sakura") === "sakura");
    const sakuraTotal = sakuraSales.reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);

    const bvSales = periodFilteredSales.filter((s) => s.shopId === "buon_viaggio");
    const bvTotal = bvSales.reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);

    const totalItems = periodFilteredSales.reduce((sum, s) => {
      return sum + (s.items || []).reduce((iSum, it) => iSum + it.quantity, 0);
    }, 0);

    return {
      totalAmount,
      count,
      avgOrder,
      sakuraTotal,
      sakuraCount: sakuraSales.length,
      bvTotal,
      bvCount: bvSales.length,
      totalItems,
    };
  }, [periodFilteredSales]);

  // ============================================================================
  // ③ 従業員別（スタッフ別）売上ランキング（指定期間内）
  // ============================================================================
  const staffRanking = useMemo(() => {
    const staffMap: {
      [key: string]: {
        userId: string;
        displayName: string;
        roleName?: string;
        isExecutive: boolean;
        totalAmount: number;
        salesCount: number;
        itemsCount: number;
        sakuraAmount: number;
        bvAmount: number;
      };
    } = {};

    // 登録ユーザーで初期化
    users.forEach((u) => {
      staffMap[u.displayName] = {
        userId: u.id,
        displayName: u.displayName,
        roleName: u.roleName || (u.role === "executive" ? "幹部" : "スタッフ"),
        isExecutive: u.role === "executive",
        totalAmount: 0,
        salesCount: 0,
        itemsCount: 0,
        sakuraAmount: 0,
        bvAmount: 0,
      };
    });

    // 期間内の売上を集計
    periodFilteredSales.forEach((sale) => {
      const staffName = sale.staffName || sale.staff_name || "店員";
      const amount = sale.totalAmount ?? sale.total_amount ?? 0;
      const isBV = sale.shopId === "buon_viaggio";
      const itemsCount = (sale.items || []).reduce((sum, it) => sum + it.quantity, 0);

      if (!staffMap[staffName]) {
        staffMap[staffName] = {
          userId: sale.staffUserId || staffName,
          displayName: staffName,
          roleName: "スタッフ",
          isExecutive: false,
          totalAmount: 0,
          salesCount: 0,
          itemsCount: 0,
          sakuraAmount: 0,
          bvAmount: 0,
        };
      }

      staffMap[staffName].totalAmount += amount;
      staffMap[staffName].salesCount += 1;
      staffMap[staffName].itemsCount += itemsCount;
      if (isBV) {
        staffMap[staffName].bvAmount += amount;
      } else {
        staffMap[staffName].sakuraAmount += amount;
      }
    });

    // 売上金額降順でソート（売上0のスタッフも含む）
    return Object.values(staffMap).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [periodFilteredSales, users]);

  // ============================================================================
  // ④ 料理・商品別 売れ筋ランキング（指定期間内）
  // ============================================================================
  const productRanking = useMemo(() => {
    const prodMap: {
      [itemId: string]: {
        id: string;
        name: string;
        shopId: ShopId;
        count: number;
        total: number;
        imageUrl?: string;
      };
    } = {};

    periodFilteredSales.forEach((sale) => {
      const saleShop: ShopId = sale.shopId === "buon_viaggio" ? "buon_viaggio" : "sakura";
      (sale.items || []).forEach((si) => {
        const itId = si.itemId || si.item_id || "";
        const itName = si.itemName || si.item_name || "";
        const itemInfo = items.find((i) => i.id === itId);

        if (!prodMap[itId]) {
          prodMap[itId] = {
            id: itId,
            name: itName,
            shopId: itemInfo?.shopId || saleShop,
            count: 0,
            total: 0,
            imageUrl: itemInfo?.image_url,
          };
        }
        prodMap[itId].count += si.quantity;
        prodMap[itId].total += si.subtotal;
      });
    });

    return Object.values(prodMap).sort((a, b) => b.total - a.total);
  }, [periodFilteredSales, items]);

  // ============================================================================
  // ⑤ 従業員別 売上伝票リスト（絞り込み適用後）
  // ============================================================================
  const finalFilteredSales = useMemo(() => {
    return periodFilteredSales.filter((sale) => {
      // 店舗フィルター
      if (selectedShopFilter !== "all" && (sale.shopId || "sakura") !== selectedShopFilter) {
        return false;
      }

      // スタッフフィルター
      if (selectedStaffFilter !== "all") {
        const targetUser = users.find((u) => u.id === selectedStaffFilter);
        if (targetUser) {
          const matched =
            sale.staffUserId === targetUser.id ||
            sale.staffName === targetUser.displayName ||
            sale.staff_name === targetUser.displayName;
          if (!matched) return false;
        }
      }

      // 決済方法フィルター
      if (filterMethod !== "all") {
        const pay = sale.payment_method || "cash";
        if (pay !== filterMethod) return false;
      }

      // 検索フィルター
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const staff = (sale.staffName || sale.staff_name || "").toLowerCase();
        const id = sale.id.toLowerCase();
        const notes = (sale.notes || "").toLowerCase();
        const itemMatch = (sale.items || []).some((i) =>
          (i.itemName || i.item_name || "").toLowerCase().includes(q)
        );
        if (!id.includes(q) && !staff.includes(q) && !notes.includes(q) && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [periodFilteredSales, selectedShopFilter, selectedStaffFilter, filterMethod, searchQuery, users]);

  // 期間ラベルの生成
  const periodLabel = useMemo(() => {
    switch (periodType) {
      case "today":
        return `本日 (${todayStr})`;
      case "week":
        return "今週 (日〜土)";
      case "month":
        return "今月 (月間)";
      case "all":
        return "全期間 (累計)";
      case "custom":
        return `${customStart} 〜 ${customEnd}`;
    }
  }, [periodType, todayStr, customStart, customEnd]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-16 text-white">
      {/* 画面ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/90 border border-stone-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-950 border border-amber-400/40 p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
            {siteBranding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteBranding.logoUrl} alt={siteBranding.siteName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl">🏪</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                売上管理・台帳
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                リアルタイム台帳
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              従業員別ランキング、商品別売れ筋、期間別集計、伝票履歴・取り消し管理
            </p>
          </div>
        </div>
      </div>

      {/* リアルタイム通知バナー */}
      {realtimeNotice && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {/* 取消・操作結果通知バナー */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-md ${
            actionNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {actionNotice.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* ========================================================
          📅 期間セレクター（ランキング・売上の集計期間を指定）
      ======================================================== */}
      <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            <span>集計・ランキング期間:</span>
            <span className="text-amber-400 font-black underline">{periodLabel}</span>
          </div>

          {/* 期間切り替えタブ */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-2xl border border-stone-800 flex-wrap">
            <button
              type="button"
              onClick={() => setPeriodType("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === "today"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              本日 (今日)
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("week")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === "week"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              今週 (週次)
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("month")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === "month"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              今月 (月間)
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === "all"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              全期間 (累計)
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("custom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodType === "custom"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              期間指定
            </button>
          </div>
        </div>

        {/* カスタム期間指定入力欄 */}
        {periodType === "custom" && (
          <div className="flex items-center gap-3 pt-3 border-t border-stone-800/80 flex-wrap text-xs font-bold">
            <span className="text-stone-400">日付範囲:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <span className="text-stone-500">〜</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          💰 売上合計 ＆ サマリーカード（指定期間）
      ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ① 期間売上合計 */}
        <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400">売上合計 ({periodLabel})</span>
            <span className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-black text-rose-400">
            {formatCurrency(periodStats.totalAmount)}
          </div>
          <div className="mt-2 text-[11px] text-stone-400 flex items-center justify-between">
            <span>伝票数: <strong className="text-white">{periodStats.count}</strong> 件</span>
            <span>販売点数: <strong className="text-white">{periodStats.totalItems}</strong> 点</span>
          </div>
        </div>

        {/* ② 🌸 和食さくら 売上 */}
        <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <span>🌸</span> 和食さくら 売上
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {periodStats.totalAmount > 0
                ? `${Math.round((periodStats.sakuraTotal / periodStats.totalAmount) * 100)}%`
                : "0%"}
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-400">
            {formatCurrency(periodStats.sakuraTotal)}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            伝票数: <strong className="text-white">{periodStats.sakuraCount}</strong> 件
          </p>
        </div>

        {/* ③ 🍷 Buon viaggio 売上 */}
        <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span>🍷</span> Buon viaggio 売上
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {periodStats.totalAmount > 0
                ? `${Math.round((periodStats.bvTotal / periodStats.totalAmount) * 100)}%`
                : "0%"}
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-400">
            {formatCurrency(periodStats.bvTotal)}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            伝票数: <strong className="text-white">{periodStats.bvCount}</strong> 件
          </p>
        </div>

        {/* ④ 客単価（平均組単価） */}
        <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">客単価 (平均組単価)</span>
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-400">
            {formatCurrency(periodStats.avgOrder)}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            1伝票あたりの平均売上金額
          </p>
        </div>
      </div>

      {/* ========================================================
          🏆 2つの売上ランキング（従業員別 ＆ 料理別）
      ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側 (7カラム): 従業員別（スタッフ別）売上ランキング */}
        <div className="lg:col-span-7 bg-stone-900/90 rounded-3xl border border-stone-800 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-black text-white">従業員別 売上ランキング</h2>
            </div>
            <span className="text-[11px] font-bold text-stone-400">
              期間: <strong className="text-amber-400">{periodLabel}</strong>
            </span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {staffRanking.map((st, idx) => {
              const maxAmount = staffRanking[0]?.totalAmount || 1;
              const ratio = maxAmount > 0 ? (st.totalAmount / maxAmount) * 100 : 0;

              return (
                <div
                  key={st.displayName}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    idx === 0
                      ? "bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/30"
                      : idx === 1
                      ? "bg-stone-950/80 border-stone-700"
                      : idx === 2
                      ? "bg-stone-950/60 border-stone-800"
                      : "bg-stone-950/40 border-stone-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* 順位バッジ */}
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm ${
                          idx === 0
                            ? "bg-amber-500 text-stone-950"
                            : idx === 1
                            ? "bg-stone-300 text-stone-900"
                            : idx === 2
                            ? "bg-amber-700 text-white"
                            : "bg-stone-800 text-stone-400"
                        }`}
                      >
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-white truncate">
                            {st.displayName}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              st.isExecutive
                                ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                                : "bg-blue-400/20 text-blue-300 border border-blue-400/30"
                            }`}
                          >
                            {st.roleName}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
                          <span>伝票: <strong className="text-stone-200">{st.salesCount}</strong>件</span>
                          <span>点数: <strong className="text-stone-200">{st.itemsCount}</strong>点</span>
                          {st.bvAmount > 0 && (
                            <span className="text-emerald-400 font-medium">
                              (BV: {formatCurrency(st.bvAmount)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 売上金額 */}
                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-black text-rose-400 block">
                        {formatCurrency(st.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* 売上比率プログレスバー */}
                  {st.totalAmount > 0 && (
                    <div className="w-full bg-stone-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? "bg-amber-500"
                            : "bg-rose-700"
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右側 (5カラム): 商品・料理別 売れ筋ランキング */}
        <div className="lg:col-span-5 bg-stone-900/90 rounded-3xl border border-stone-800 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-rose-500" />
              <h2 className="text-base font-black text-white">料理・商品 売れ筋TOP</h2>
            </div>
            <span className="text-[11px] font-bold text-stone-400">売上金額順</span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {productRanking.length === 0 ? (
              <p className="text-xs text-stone-500 py-10 text-center">
                該当期間の料理販売実績はありません
              </p>
            ) : (
              productRanking.map((prod, idx) => (
                <div
                  key={prod.id || idx}
                  className="p-3 rounded-2xl border border-stone-800 bg-stone-950/60 flex items-center justify-between gap-3 hover:border-stone-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                        idx === 0
                          ? "bg-amber-400 text-stone-950 font-black"
                          : idx === 1
                          ? "bg-stone-300 text-stone-950 font-black"
                          : idx === 2
                          ? "bg-amber-800 text-white font-black"
                          : "bg-stone-800 text-stone-400"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {prod.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-9 h-9 rounded-xl object-cover border border-stone-700 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
                        <Utensils className="w-4 h-4 text-stone-400" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {prod.name}
                        </span>
                        {(() => {
                          const sInfo = shops.find((s) => s.id === (prod.shopId || "sakura"));
                          return (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-stone-800 text-amber-300 border border-stone-700">
                              {sInfo ? `${sInfo.icon} ${sInfo.shortName}` : "🏪"}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        販売数: <strong className="text-white">{prod.count}</strong> 点
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-black text-rose-400">
                      {formatCurrency(prod.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          📜 従業員別 売上伝票・販売履歴台帳（トップページから統合）
      ======================================================== */}
      <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-500" />
              従業員別 売上伝票・販売履歴台帳
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              誰がいつ・どの店舗で商品を販売したかの全伝票台帳です（誤操作時の取り消しロールバック対応）
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
            {/* 店舗フィルター */}
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-2xl border border-stone-800 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedShopFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedShopFilter === "all"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                全店舗
              </button>
              {shops.map((shop) => {
                const isSelected = selectedShopFilter === shop.id;
                const c = shop.themeColor || shop.color;
                const activeColorClass =
                  c === "emerald"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : c === "amber"
                    ? "bg-amber-600 text-white shadow-xs"
                    : c === "blue"
                    ? "bg-blue-600 text-white shadow-xs"
                    : c === "purple"
                    ? "bg-purple-600 text-white shadow-xs"
                    : c === "stone"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "bg-rose-600 text-white shadow-xs";

                return (
                  <button
                    key={shop.id}
                    type="button"
                    onClick={() => setSelectedShopFilter(shop.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected ? activeColorClass : "text-stone-400 hover:text-white"
                    }`}
                  >
                    <span>{shop.icon}</span> {shop.name}
                  </button>
                );
              })}
            </div>

            {/* 決済種別 */}
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="text-xs px-3 py-1.5 bg-stone-950 rounded-xl border border-stone-800 font-bold text-stone-300 focus:outline-none focus:border-rose-500"
            >
              <option value="all">全決済方法</option>
              <option value="cash">現金</option>
              <option value="card">クレジットカード</option>
              <option value="electronic">電子マネー / QR</option>
            </select>
          </div>
        </div>

        {/* スタッフ絞り込みボタン群 ＆ 検索バー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-stone-950 p-1.5 rounded-2xl border border-stone-800 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedStaffFilter("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedStaffFilter === "all"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              全員
            </button>
            {users.map((u) => {
              const userSalesCount = periodFilteredSales.filter(
                (s) => s.staffUserId === u.id || s.staffName === u.displayName || s.staff_name === u.displayName
              ).length;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedStaffFilter(u.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                    selectedStaffFilter === u.id
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <User className="w-3 h-3" />
                  {u.displayName} ({userSalesCount})
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
            <input
              type="text"
              placeholder="伝票ID・担当者・商品名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 bg-stone-950 rounded-xl border border-stone-800 text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 w-full sm:w-56 font-medium"
            />
          </div>
        </div>

        {/* 伝票カードリスト */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {finalFilteredSales.length === 0 ? (
            <div className="text-center py-12 bg-stone-950/40 rounded-2xl border border-stone-800/60">
              <p className="text-xs text-stone-400 font-bold">該当する売上伝票はありません</p>
              <p className="text-[11px] text-stone-500 mt-1">
                期間・店舗・スタッフの絞り込み条件を変更してください
              </p>
            </div>
          ) : (
            finalFilteredSales.map((sale) => {
              const targetShop = shops.find((s) => s.id === (sale.shopId || "sakura"));
              const amount = sale.totalAmount ?? sale.total_amount ?? 0;

              return (
                <div
                  key={sale.id}
                  className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 hover:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-stone-400">
                        #{sale.id}
                      </span>
                      {/* 店舗バッジ */}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md border bg-stone-800 text-amber-300 border-stone-700 flex items-center gap-1">
                        <span>{targetShop?.icon || "🏪"}</span>
                        <span>{targetShop?.name || "店舗"}</span>
                      </span>
                      {/* 担当者 */}
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        担当: {sale.staffName || sale.staff_name || "店員"}
                      </span>
                      {/* 決済種別 */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          sale.payment_method === "card"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : sale.payment_method === "electronic"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-stone-800 text-stone-400 border border-stone-700"
                        }`}
                      >
                        {sale.payment_method === "card"
                          ? "クレカ"
                          : sale.payment_method === "electronic"
                          ? "電子マネー"
                          : "現金"}
                      </span>

                      {/* 調整値引きバッジ */}
                      {sale.discountAmount && sale.discountAmount > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-amber-400" />
                          値引 -¥{sale.discountAmount.toLocaleString()}{sale.discountReason ? ` (${sale.discountReason})` : ""}
                        </span>
                      )}

                      {/* 日時 */}
                      <span className="text-[11px] text-stone-500">
                        {formatDate(sale.created_at)}
                      </span>
                    </div>

                    {/* 販売明細商品 */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(sale.items || []).map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl bg-stone-900 border border-stone-800 text-[11px] font-semibold text-stone-300"
                        >
                          {it.itemName || it.item_name}{" "}
                          <strong className="text-amber-400 font-bold">
                            ×{it.quantity}
                          </strong>
                        </span>
                      ))}
                    </div>

                    {sale.notes && (
                      <p className="text-[11px] text-stone-500 mt-1.5 italic">
                        メモ: {sale.notes}
                      </p>
                    )}
                  </div>

                  {/* 売上金額 ＆ 取消ボタン */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="text-right">
                      {sale.discountAmount && sale.discountAmount > 0 ? (
                        <div>
                          <div className="text-[10px] text-stone-500 line-through font-bold">
                            小計 {formatCurrency(sale.subtotalAmount || (amount + sale.discountAmount))}
                          </div>
                          <div className="text-[10px] text-amber-400 font-black">
                            値引 -¥{sale.discountAmount.toLocaleString()}
                          </div>
                          <span className="text-lg sm:text-xl font-black block tracking-tight text-white">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[10px] text-stone-400 block">売上金額</span>
                          <span className="text-lg sm:text-xl font-black text-white">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelSale(sale.id, amount)}
                      title="この売上伝票を取り消す（販売在庫復元 ＆ 金庫7割入金分ロールバック）"
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 active:scale-95 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>取消</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
