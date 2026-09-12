"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  ArrowRight,
  History,
  Sparkles,
  Edit2,
  Utensils,
  Layers,
  Radio,
  Undo2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { Item, ShopId, SHOPS } from "@/types";
import { supabase } from "@/lib/supabase";

export default function InventoryPage() {
  const { items, products, ingredients, adjustStock, actionLogs, refreshData, cancelCraftByLog } = useApp();
  const [selectedTab, setSelectedTab] = useState<"all" | "sakura" | "buon_viaggio" | "ingredient">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [newStockInput, setNewStockInput] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("仕入れ・補充");
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  const handleCancelCraftLog = (logId: string, title: string) => {
    if (
      window.confirm(
        `この作成処理を取り消しますか？\n\n対象: ${title}\n\n【取り消し処理内容】\n・完成商品の在庫を減算します\n・消費された素材在庫を元通り復元します`
      )
    ) {
      const res = cancelCraftByLog(logId);
      if (res.success) {
        setRealtimeNotice(res.message);
      } else {
        alert(res.message);
      }
      setTimeout(() => setRealtimeNotice(null), 4000);
    }
  };

  // 全体在庫画面の Supabase Realtime サブスクリプション
  useEffect(() => {
    const channel = supabase
      .channel("inventory_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_items" },
        (payload) => {
          refreshData();
          if (payload.eventType === "UPDATE") {
            const newItem = payload.new as any;
            setRealtimeNotice(`「${newItem.name}」の在庫が自動同期されました (現在: ${newItem.current_stock}${newItem.unit})`);
          } else if (payload.eventType === "INSERT") {
            setRealtimeNotice("新しい商品・素材が自動追加されました！");
          } else if (payload.eventType === "DELETE") {
            setRealtimeNotice("商品・素材の削除が同期されました！");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_action_logs" },
        () => {
          refreshData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // 店舗別商品
  const sakuraProducts = products.filter((p) => (p.shopId || "sakura") === "sakura");
  const bvProducts = products.filter((p) => p.shopId === "buon_viaggio");

  // フィルタリング
  const filteredItems = items.filter((item) => {
    let matchesTab = true;
    if (selectedTab === "sakura") {
      matchesTab = item.type === "product" && (item.shopId || "sakura") === "sakura";
    } else if (selectedTab === "buon_viaggio") {
      matchesTab = item.type === "product" && item.shopId === "buon_viaggio";
    } else if (selectedTab === "ingredient") {
      matchesTab = item.type === "ingredient";
    }
    const matchesQuery =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesQuery;
  });

  // 在庫警告集計 (5個以下を僅少とする)
  const lowStockItems = items.filter((i) => i.current_stock <= 5);

  // 在庫関連のログのみ抽出
  const inventoryLogs = actionLogs.filter(
    (l) => l.category === "inventory" || l.category === "craft" || l.category === "sale"
  ).slice(0, 15);

  const handleOpenAdjust = (item: Item) => {
    setAdjustingItem(item);
    setNewStockInput(item.current_stock);
    setAdjustReason("仕入れ・棚卸し");
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    adjustStock(adjustingItem.id, Math.max(0, newStockInput), adjustReason);
    setAdjustingItem(null);
  };

  const handleQuickDelta = (item: Item, delta: number) => {
    const target = Math.max(0, item.current_stock + delta);
    adjustStock(
      item.id,
      target,
      delta > 0 ? `クイック補充 (+${delta})` : `クイック消費 (${delta})`
    );
  };

  return (
    <div className="space-y-6 max-w-[1680px] w-full mx-auto px-2.5 sm:px-4 md:px-6 py-4 pb-16">
      {/* ページヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Boxes className="w-7 h-7 text-amber-500" />
              全体在庫一覧
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              一般・幹部共通
            </span>
          </div>
          <p className="text-xs text-stone-300 mt-1">
            「和食さくら」および「Buon viaggio」の全料理商品、およびクラフト用共通原材料の在庫を確認・調整できます
          </p>
        </div>
      </div>

      {/* リアルタイム更新通知バナー */}
      {realtimeNotice && (
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {/* サマリーカード (4分割) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ① 和食さくら */}
        <div className="bg-stone-900/90 p-4 rounded-2xl border border-stone-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
              <span>🌸</span>
              和食さくら (料理)
            </span>
            <div className="mt-2 text-2xl font-black text-white">
              {sakuraProducts.length} <span className="text-sm font-normal text-stone-400">品目</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-1 font-medium">
              総在庫: <strong className="text-white font-bold">{sakuraProducts.reduce((acc, p) => acc + p.current_stock, 0)}</strong> 個
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 text-rose-400 flex items-center justify-center font-black text-xl shadow-inner">
            🍱
          </div>
        </div>

        {/* ② Buon viaggio */}
        <div className="bg-stone-900/90 p-4 rounded-2xl border border-stone-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
              <span>🍷</span>
              Buon viaggio (料理)
            </span>
            <div className="mt-2 text-2xl font-black text-white">
              {bvProducts.length} <span className="text-sm font-normal text-stone-400">品目</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-1 font-medium">
              総在庫: <strong className="text-white font-bold">{bvProducts.reduce((acc, p) => acc + p.current_stock, 0)}</strong> 個
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 text-emerald-400 flex items-center justify-center font-black text-xl shadow-inner">
            🍕
          </div>
        </div>

        {/* ③ 共通素材 */}
        <div className="bg-stone-900/90 p-4 rounded-2xl border border-stone-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-stone-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-stone-400" />
              クラフト素材 (2店舗共通)
            </span>
            <div className="mt-2 text-2xl font-black text-white">
              {ingredients.length} <span className="text-sm font-normal text-stone-400">品目</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-1 font-medium">
              総在庫: <strong className="text-white font-bold">{ingredients.reduce((acc, i) => acc + i.current_stock, 0)}</strong> 個
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 flex items-center justify-center font-black text-xl shadow-inner">
            🥬
          </div>
        </div>

        {/* ④ 在庫僅少アラート */}
        <div className="bg-stone-900/90 p-4 rounded-2xl border border-stone-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              在庫僅少アラート (5個以下)
            </span>
            <div className="mt-2 text-2xl font-black text-rose-400">
              {lowStockItems.length} <span className="text-sm font-normal text-stone-400">品目</span>
            </div>
            <p className="text-[11px] text-rose-300 mt-1 font-medium">
              {lowStockItems.length > 0 ? "早めの仕入れ・作成を推奨" : "すべて十分な在庫があります"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-black text-xl shadow-inner">
            ⚠️
          </div>
        </div>
      </div>

      {/* 検索 & タブフィルター */}
      <div className="bg-stone-900/90 p-3 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 flex-wrap">
          <button
            onClick={() => setSelectedTab("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTab === "all"
                ? "bg-stone-700 text-white shadow-xs"
                : "text-stone-400 hover:text-white"
            }`}
          >
            すべて ({items.length})
          </button>
          <button
            onClick={() => setSelectedTab("sakura")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              selectedTab === "sakura"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <span>🌸</span> 和食さくら ({sakuraProducts.length})
          </button>
          <button
            onClick={() => setSelectedTab("buon_viaggio")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              selectedTab === "buon_viaggio"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <span>🍷</span> Buon viaggio ({bvProducts.length})
          </button>
          <button
            onClick={() => setSelectedTab("ingredient")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              selectedTab === "ingredient"
                ? "bg-stone-700 text-white shadow-xs"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <span>🥬</span> 共通素材 ({ingredients.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="商品名・素材名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs pl-9 pr-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* 在庫カードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isProduct = item.type === "product";
          const isLow = item.current_stock <= 5;
          const isZero = item.current_stock === 0;

          return (
            <div
              key={item.id}
              className={`bg-stone-900/90 rounded-2xl border transition-all p-4 sm:p-5 shadow-md flex flex-col justify-between ${
                isZero
                  ? "border-rose-500/50 bg-rose-950/20"
                  : isLow
                  ? "border-amber-500/40 bg-amber-950/10"
                  : "border-stone-800 hover:border-stone-700"
              }`}
            >
              <div>
                {/* カード上部: サムネイル & 基本情報 */}
                <div className="flex items-start gap-3.5">
                  {/* 画像（素材・商品ともに画像付きでしっかり表示） */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-stone-950 border border-stone-800 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl">{isProduct ? "🍱" : "🥬"}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isProduct ? (
                        item.shopId === "buon_viaggio" ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🍷 Buon viaggio
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            🌸 和食さくら
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          🥬 共通素材
                        </span>
                      )}
                      <span className="text-[10px] text-stone-400 font-medium">
                        {item.category_name}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm sm:text-base mt-1 truncate">
                      {item.name}
                    </h3>

                    {isProduct && (
                      <p className="text-xs font-black text-rose-400 mt-0.5">
                        販売価格: {formatCurrency(item.selling_price)}
                      </p>
                    )}
                  </div>
                </div>

                {/* 料理商品の場合: クラフトレシピの必要素材表示 */}
                {isProduct && (
                  <div className="mt-3 p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 text-xs">
                    <div className="text-[11px] font-bold text-amber-400 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      1つ作るのに必要な素材:
                    </div>
                    {item.recipe && item.recipe.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.recipe.map((r, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-[11px] font-semibold text-stone-200 shadow-xs"
                          >
                            {r.ingredient_name}{" "}
                            <span className="text-amber-400 font-bold">×{r.quantity}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-stone-500">
                        素材レシピ未設定（幹部画面で設定可能）
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* カード下部: 在庫数 & ボタン */}
              {isProduct ? (
                /* ===================================================
                   ① 商品の場合: 大きな在庫数 ＋ 「調整」ボタンのみ
                =================================================== */
                <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-stone-400 block mb-0.5">現在庫:</span>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-3xl sm:text-4xl font-black tracking-tight ${
                          isZero
                            ? "text-rose-400"
                            : isLow
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {item.current_stock.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-stone-400">{item.unit}</span>
                      {isZero ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 ml-1">
                          在庫切れ
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-1">
                          僅少
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* 商品は調整ボタンのみ */}
                  <button
                    type="button"
                    onClick={() => handleOpenAdjust(item)}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="手動で在庫数を指定"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>調整</span>
                  </button>
                </div>
              ) : (
                /* ===================================================
                   ② 素材の場合: 大きな在庫数 ＋ [1] [100] [1000] 単位 ＋ 「調整」
                =================================================== */
                <div className="mt-4 pt-3 border-t border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-stone-400 block mb-0.5">現在庫:</span>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-3xl sm:text-4xl font-black tracking-tight ${
                            isZero
                              ? "text-rose-400"
                              : isLow
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {item.current_stock.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-stone-400">{item.unit}</span>
                        {isZero ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 ml-1">
                            在庫切れ
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-1">
                            僅少
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* 素材用のボタン: 1, 100, 1000 単位 ＋ 調整 */}
                  <div className="flex items-center gap-1.5">
                    {[1, 100, 1000].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => handleQuickDelta(item, qty)}
                        className="flex-1 py-2 px-1 rounded-xl bg-stone-800 hover:bg-stone-700 hover:border-amber-500/50 text-stone-100 border border-stone-700 font-black text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                        title={`+${qty}${item.unit} 追加`}
                      >
                        +{qty.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleOpenAdjust(item)}
                      className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-md shadow-amber-950/40 cursor-pointer active:scale-95 shrink-0"
                      title="手動で在庫数を指定"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>調整</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 在庫手動調整モーダル */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-800 text-white">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-500" />
              「{adjustingItem.name}」の在庫調整
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              仕入れや棚卸しによる在庫数の直接変更を行います（操作ログに記録されます）
            </p>

            <form onSubmit={handleSaveAdjust} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  新しい在庫数 ({adjustingItem.unit}):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newStockInput}
                    onChange={(e) => setNewStockInput(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 font-black text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
                    required
                  />
                  <span className="text-sm font-bold text-stone-400 shrink-0">
                    {adjustingItem.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  調整理由・メモ:
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="例: 仕入れ買い出し、棚卸し確認、廃棄など"
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 rounded-xl border border-stone-700 text-xs font-bold text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-md shadow-amber-900/40 transition-all cursor-pointer"
                >
                  在庫を更新する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 直近の在庫変動ログ */}
      <div className="bg-stone-900/90 rounded-2xl border border-stone-800 p-5 shadow-md text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-white">直近の在庫変動ログ（作成・販売・調整）</h2>
          </div>
          <span className="text-[11px] text-stone-400">リアルタイム同期</span>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {inventoryLogs.length === 0 ? (
            <p className="text-xs text-stone-500 py-4 text-center">まだ在庫変動の履歴はありません</p>
          ) : (
            inventoryLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-stone-800 bg-stone-950/70 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        log.category === "craft"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : log.category === "sale"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {log.category === "craft"
                        ? "作成 (クラフト)"
                        : log.category === "sale"
                        ? "販売"
                        : "手動調整"}
                    </span>
                    <span className="font-bold text-white">{log.title}</span>
                    <span className="text-[11px] text-stone-400 font-medium">
                      担当: <strong className="text-stone-200">{log.userName}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">{log.detail}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <span className="text-[10px] text-stone-500">
                    {new Date(log.created_at).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {log.category === "craft" && (
                    <button
                      type="button"
                      onClick={() => handleCancelCraftLog(log.id, log.title)}
                      title="この作成処理を取り消す（在庫減算 ＆ 素材在庫を元に戻す）"
                      className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 active:scale-95 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>取消</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
