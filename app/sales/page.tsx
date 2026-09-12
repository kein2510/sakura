"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  PlusCircle,
  CreditCard,
  Banknote,
  QrCode,
  Calendar,
  Filter,
  Search,
  ArrowUpDown,
  Utensils,
  Award,
  Sparkles,
  Radio,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import SalesModal from "@/components/SalesModal";
import { PaymentMethod } from "@/types";
import { supabase } from "@/lib/supabase";

export default function SalesPage() {
  const { sales, items, refreshData } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // 売上画面の Supabase Realtime サブスクリプション (.channel() / .on())
  useEffect(() => {
    const channel = supabase
      .channel("sales_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_sales" },
        (payload) => {
          refreshData();
          if (payload.eventType === "INSERT") {
            setRealtimeNotice("新しい売上伝票が自動同期されました！");
          } else if (payload.eventType === "UPDATE") {
            setRealtimeNotice("売上伝票の更新が反映されました！");
          } else if (payload.eventType === "DELETE") {
            setRealtimeNotice("売上伝票の削除が反映されました！");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // 集計計算
  const totalSalesAmount = sales.reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);
  const count = sales.length;
  const avgOrder = count > 0 ? Math.round(totalSalesAmount / count) : 0;

  // 決済方法別集計
  const creditSales = sales.filter((s) => s.payment_method === "card").reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);
  const qrSales = sales.filter((s) => s.payment_method === "electronic").reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);
  const cashSales = sales.filter((s) => !s.payment_method || s.payment_method === "cash" || s.payment_method === "fivem_cash").reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);

  // 商品別売れ筋集計
  const productSalesMap: { [itemId: string]: { name: string; count: number; total: number; imageUrl?: string } } = {};
  sales.forEach((sale) => {
    sale.items.forEach((si) => {
      const itId = si.itemId || si.item_id || "";
      const itName = si.itemName || si.item_name || "";
      const itemInfo = items.find((i) => i.id === itId);
      if (!productSalesMap[itId]) {
        productSalesMap[itId] = {
          name: itName,
          count: 0,
          total: 0,
          imageUrl: itemInfo?.image_url,
        };
      }
      productSalesMap[itId].count += si.quantity;
      productSalesMap[itId].total += si.subtotal;
    });
  });

  const topProducts = Object.values(productSalesMap).sort((a, b) => b.total - a.total);

  // フィルタリング
  const filteredSales = sales.filter((sale) => {
    const matchesMethod = filterMethod === "all" || (sale.payment_method || "cash") === filterMethod;
    const staff = sale.staffName || sale.staff_name || "";
    const matchesQuery =
      searchQuery === "" ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.notes && sale.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sale.items.some((i) => (i.itemName || i.item_name || "").toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesMethod && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-12">
      {/* 画面ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">売上管理</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
              リアルタイム更新
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            売上伝票の即時集計、リアルタイム同期、決済種別ごとの分析
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-900/20 transition-all hover:scale-[1.02] self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          新規売上入力
        </button>
      </div>

      {/* リアルタイム更新通知バナー */}
      {realtimeNotice && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500">売上合計（本日）</span>
          <div className="mt-2 text-2xl font-black text-rose-600">{formatCurrency(totalSalesAmount)}</div>
          <p className="text-[11px] text-stone-400 mt-2">伝票数: {count} 件</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500">平均組単価</span>
          <div className="mt-2 text-2xl font-black text-stone-900">{formatCurrency(avgOrder)}</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-2">高単価コース好調</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500">キャッシュレス比率</span>
          <div className="mt-2 text-2xl font-black text-stone-900">
            {totalSalesAmount > 0
              ? `${Math.round(((creditSales + qrSales) / totalSalesAmount) * 100)}%`
              : "0%"}
          </div>
          <div className="flex gap-2 text-[10px] text-stone-500 mt-2">
            <span>カード: {formatCurrency(creditSales)}</span>
            <span>QR: {formatCurrency(qrSales)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500">現金売上高</span>
          <div className="mt-2 text-2xl font-black text-stone-900">{formatCurrency(cashSales)}</div>
          <p className="text-[11px] text-stone-400 mt-2">レジ在高照合用</p>
        </div>
      </div>

      {/* 2カラム構成: 売上一覧テーブル ＋ 売れ筋ランキング */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 売上一覧テーブル (8カラム) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex flex-col">
          {/* テーブルツールバー */}
          <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="伝票番号、担当者、料理名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 bg-white rounded-lg border border-stone-300 focus:ring-2 focus:ring-rose-500 w-56"
                />
              </div>

              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-white rounded-lg border border-stone-300 font-medium text-stone-700"
              >
                <option value="all">すべての決済方法</option>
                <option value="credit">クレジットカード</option>
                <option value="qr">QR / 電子マネー</option>
                <option value="cash">現金</option>
              </select>
            </div>

            <span className="text-xs text-stone-500 font-medium">
              該当: <span className="font-bold text-stone-900">{filteredSales.length}</span> 件
            </span>
          </div>

          {/* テーブル本体 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100/70 text-stone-600 font-bold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">伝票番号</th>
                  <th className="py-3 px-3">登録日時</th>
                  <th className="py-3 px-3">注文明細</th>
                  <th className="py-3 px-3">担当者</th>
                  <th className="py-3 px-3">決済</th>
                  <th className="py-3 px-4 text-right">金額 (税込)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-stone-400">
                      一致する売上伝票がありません
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-stone-900">
                        {sale.id}
                        {sale.notes && (
                          <span className="block text-[10px] text-stone-400 font-normal mt-0.5">
                            {sale.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-stone-500 whitespace-nowrap">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="py-3.5 px-3 text-stone-700 max-w-xs">
                        <div className="space-y-0.5">
                          {sale.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded bg-stone-100 text-[11px]"
                            >
                              {it.itemName || it.item_name} × <strong className="text-stone-900">{it.quantity}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-stone-600 whitespace-nowrap">
                        {sale.staffName || sale.staff_name || "店員"}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sale.payment_method === "card"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : sale.payment_method === "electronic"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {sale.payment_method === "card"
                            ? "クレカ"
                            : sale.payment_method === "electronic"
                            ? "電子マネー"
                            : "現金"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-stone-900 text-sm whitespace-nowrap">
                        {formatCurrency(sale.totalAmount ?? sale.total_amount ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右側: 売れ筋人気料理ランキング (4カラム) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-xs p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-stone-900">本日売れ筋料理ランキング</h2>
          </div>

          <div className="space-y-3 overflow-y-auto flex-1 max-h-[500px] pr-1">
            {topProducts.map((prod, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      idx === 0
                        ? "bg-amber-400 text-stone-900"
                        : idx === 1
                        ? "bg-stone-300 text-stone-800"
                        : idx === 2
                        ? "bg-amber-700 text-white"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {prod.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-stone-200 flex items-center justify-center shrink-0">
                      <Utensils className="w-4 h-4 text-stone-400" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{prod.name}</p>
                    <p className="text-[11px] text-stone-500">{prod.count} 注文</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-rose-600">
                    {formatCurrency(prod.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SalesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
