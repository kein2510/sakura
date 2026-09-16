"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Hammer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Boxes,
  Plus,
  Minus,
  Sparkles,
  Store,
  Radio,
  Undo2,
  Tag,
  Percent,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { ShopId, SHOPS } from "@/types";
import { supabase } from "@/lib/supabase";

export default function MainPage() {
  const { items, products, ingredients, sellProducts, craftProducts, refreshData, rollbackCraftItems, storeSettings } = useApp();

  // 現在選択中の店舗 ("sakura" | "buon_viaggio")
  const [selectedShopId, setSelectedShopId] = useState<ShopId>("sakura");

  // 各商品の選択個数ステート { [itemId]: number }
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
  // 調整値引きステート
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const [showDiscountForm, setShowDiscountForm] = useState<boolean>(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // 直前のクラフト情報（取り消し用）
  const [lastCraft, setLastCraft] = useState<{
    quantities: Record<string, number>;
    shopId: ShopId;
    names: string[];
  } | null>(null);

  // メイン画面の Supabase Realtime サブスクリプション
  useEffect(() => {
    const channel = supabase
      .channel("main_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_items" },
        (payload) => {
          refreshData();
          if (payload.eventType === "UPDATE") {
            const newItem = payload.new as any;
            setRealtimeNotice(`【在庫更新】「${newItem.name}」が同期されました (現在庫: ${newItem.current_stock}${newItem.unit})`);
          } else if (payload.eventType === "INSERT") {
            setRealtimeNotice("【商品追加】新しい商品が同期されました！");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_sales" },
        (payload) => {
          refreshData();
          if (payload.eventType === "INSERT") {
            const s = payload.new as any;
            setRealtimeNotice(`【売上登録】${s.staff_name}が売上 ¥${Number(s.total_amount).toLocaleString()} を登録しました！`);
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // 選択中店舗の料理商品のみを抽出 (未設定のものはデフォルトで sakura 扱い)
  const currentShopProducts = products.filter(
    (p) => (p.shopId || "sakura") === selectedShopId
  );

  const currentShopInfo = SHOPS.find((s) => s.id === selectedShopId) || SHOPS[0];

  // 個数更新
  const handleSetQuantity = (itemId: string, qty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, qty),
    }));
  };

  // 画像2枚目のクイック加算ボタン [0], [1], [10], [100]
  const handleQuickAdd = (itemId: string, addAmount: number) => {
    if (addAmount === 0) {
      handleSetQuantity(itemId, 0);
    } else {
      const current = quantities[itemId] || 0;
      handleSetQuantity(itemId, current + addAmount);
    }
  };

  // 全リセット
  const handleResetAll = () => {
    setQuantities({});
    setDiscountAmount(0);
    setDiscountReason("");
    setShowDiscountForm(false);
    setNotification(null);
  };

  // 店舗切り替え
  const handleSwitchShop = (shopId: ShopId) => {
    if (selectedShopId !== shopId) {
      setSelectedShopId(shopId);
      setQuantities({}); // 店舗が変わったら選択個数はリセット
      setDiscountAmount(0);
      setDiscountReason("");
      setShowDiscountForm(false);
      setNotification(null);
    }
  };

  // 小計金額の計算 (選択中店舗の 数量 × 単価)
  const subtotal = currentShopProducts.reduce((sum, item) => {
    const qty = quantities[item.id] || 0;
    return sum + item.selling_price * qty;
  }, 0);

  // 調整値引きを反映した最終お会計金額
  const validDiscount = Math.max(0, Math.min(subtotal, Math.round(Number(discountAmount) || 0)));
  const finalTotalAmount = Math.max(0, subtotal - validDiscount);

  // 合計個数の計算
  const totalItemsCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  // 「売る」実行
  const handleSell = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "販売する商品の個数を指定してください。" });
      return;
    }

    const result = sellProducts(quantities, selectedShopId, validDiscount, discountReason);
    if (result.success) {
      setNotification({ type: "success", message: result.message });
      setQuantities({});
      setDiscountAmount(0);
      setDiscountReason("");
      setShowDiscountForm(false);
    } else {
      setNotification({ type: "error", message: result.message });
    }
  };

  // 「作成 (在庫を増やす)」実行
  const handleCraft = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "作成する商品の個数を指定してください。" });
      return;
    }

    const currentQuantities = { ...quantities };
    const currentShop = selectedShopId;
    const craftedNames = Object.entries(currentQuantities)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => {
        const it = items.find((i) => i.id === id);
        return `${it?.name || "商品"} ×${q}`;
      });

    const result = craftProducts(currentQuantities, currentShop);
    if (result.success) {
      setLastCraft({
        quantities: currentQuantities,
        shopId: currentShop,
        names: craftedNames,
      });
      setNotification({ type: "success", message: result.message });
      setQuantities({});
    } else {
      setNotification({ type: "error", message: result.message });
    }
  };

  // 直前のクラフト作成を取り消す（在庫減算 ＆ 素材在庫復元）
  const handleRollbackLastCraft = () => {
    if (!lastCraft) return;
    if (
      window.confirm(
        `直前に作成した処理を取り消しますか？\n\n【取り消し対象】\n${lastCraft.names.join("、")}\n\n・完成商品の在庫を減算します\n・消費された素材在庫を元通り復元します`
      )
    ) {
      const result = rollbackCraftItems(lastCraft.quantities, lastCraft.shopId);
      if (result.success) {
        setNotification({ type: "success", message: result.message });
        setLastCraft(null);
      } else {
        setNotification({ type: "error", message: result.message });
      }
    }
  };

  return (
    <div className="w-full min-h-full">
      {/* 画面上部コントロールバー（ヘッダー直下に隙間ゼロで完全吸着する全幅不透明 sticky バー） */}
      <div className="sticky top-0 z-30 w-full bg-stone-950 border-b border-stone-800 shadow-2xl px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-3">
          {/* リアルタイム同期通知 */}
          {realtimeNotice && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>{realtimeNotice}</span>
            </div>
          )}

          {/* ① 店舗切り替えセレクター（和食さくら / Buon viaggio） */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-stone-400 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-500" />
                店舗切り替え:
              </span>
              <div className="inline-flex p-1 rounded-2xl bg-stone-900 border border-stone-800">
                <button
                  type="button"
                  onClick={() => handleSwitchShop("sakura")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedShopId === "sakura"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/50 scale-[1.02]"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <span>🌸 和食さくら</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchShop("buon_viaggio")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedShopId === "buon_viaggio"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50 scale-[1.02]"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <span>🍷 Buon viaggio</span>
                </button>
              </div>
            </div>

            <span className="text-[11px] font-bold text-stone-400">
              現在選択中:{" "}
              <strong
                className={
                  selectedShopId === "sakura" ? "text-rose-400 font-black" : "text-emerald-400 font-black"
                }
              >
                {currentShopInfo.name}
              </strong>{" "}
              ({currentShopProducts.length}商品)
            </span>
          </div>

          {/* ② 合計金額 & 売る・作成アクションバー（完全不透明 bg-stone-900・高さ固定） */}
          <div className="bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-800 shadow-md space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* 左側: ロゴ & 合計金額表示 */}
              <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap justify-between sm:justify-start">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl border p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden ${
                      selectedShopId === "sakura"
                        ? "bg-stone-950 border-amber-400/40 shadow-rose-950/40"
                        : "bg-emerald-950 border-emerald-400/40 shadow-emerald-950/40 text-2xl"
                    }`}
                  >
                    {selectedShopId === "sakura" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/logo.png" alt="和食さくら" className="w-full h-full object-contain" />
                    ) : (
                      <span>🍷</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-stone-400 block truncate">
                      【{currentShopInfo.name}】選択中 ({totalItemsCount}点)
                    </span>

                    <div className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="text-xs font-bold text-stone-400">合計:</span>
                      <span
                        className={`text-2xl sm:text-3xl font-black tracking-tight ${
                          selectedShopId === "sakura" ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {formatCurrency(finalTotalAmount)}
                      </span>
                      {validDiscount > 0 && (
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <span>(-¥{validDiscount.toLocaleString()})</span>
                          <span className="text-[11px] text-stone-500 line-through hidden md:inline">
                            小計 {formatCurrency(subtotal)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {totalItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDiscountForm(!showDiscountForm)}
                      className={`h-9 px-3 rounded-xl border transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                        validDiscount > 0
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs"
                          : showDiscountForm
                          ? "bg-stone-700 text-white border-stone-600"
                          : "bg-stone-800 text-stone-300 hover:text-white border-stone-700 hover:bg-stone-700"
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{validDiscount > 0 ? "値引き中" : "調整値引き"}</span>
                    </button>
                  )}

                  {totalItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="h-9 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>クリア</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 右側: 「売る」ボタン ＆ 「作成 (在庫増)」ボタン（改行防止・固定サイズ） */}
              <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                {/* 売るボタン */}
                <button
                  type="button"
                  onClick={handleSell}
                  disabled={totalItemsCount === 0}
                  className="flex-1 lg:flex-initial h-11 px-6 rounded-2xl bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-sm text-white shadow-md shadow-rose-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>売る (在庫減算)</span>
                </button>

                {/* 作成ボタン (在庫を作った時のボタン - 機能有効時のみ表示) */}
                {storeSettings.enableCrafting && (
                  <button
                    type="button"
                    onClick={handleCraft}
                    disabled={totalItemsCount === 0}
                    className="flex-1 lg:flex-initial h-11 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-sm text-white shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Hammer className="w-4 h-4 shrink-0" />
                    <span>作成 (在庫増)</span>
                  </button>
                )}
              </div>
            </div>

            {/* 調整値引き入力パネル (トグルまたは値引き設定時表示) */}
            {(showDiscountForm || validDiscount > 0) && totalItemsCount > 0 && (
              <div className="pt-3 border-t border-stone-800 bg-stone-950/85 p-3.5 rounded-2xl border border-stone-800 space-y-3 animate-in fade-in duration-150">
                {/* 上段: 値引き額の直接入力 & % 入力 & リセット */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* 円単位の直接入力 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        値引き額:
                      </span>
                      <div className="flex items-center gap-1 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-700">
                        <span className="text-xs text-stone-400 font-bold">-¥</span>
                        <input
                          type="number"
                          min="0"
                          max={subtotal}
                          value={discountAmount === 0 ? "" : discountAmount}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(subtotal, parseInt(e.target.value) || 0));
                            setDiscountAmount(val);
                          }}
                          placeholder="0"
                          className="w-28 bg-transparent text-amber-300 font-black text-base focus:outline-none"
                        />
                        <span className="text-xs text-stone-500 font-bold">円</span>
                      </div>
                    </div>

                    {/* ％での指定入力 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-400 flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-amber-500" />
                        割合:
                      </span>
                      <div className="flex items-center gap-1 bg-stone-900 px-2.5 py-1.5 rounded-xl border border-stone-700">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : ""}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                            const amt = Math.round(subtotal * (pct / 100));
                            setDiscountAmount(amt);
                            if (pct > 0) setDiscountReason(`${pct}% OFF`);
                          }}
                          placeholder="0"
                          className="w-12 bg-transparent text-amber-300 font-black text-sm text-center focus:outline-none"
                        />
                        <span className="text-xs text-stone-400 font-bold">% OFF</span>
                      </div>
                    </div>

                    {discountAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => { setDiscountAmount(0); setDiscountReason(""); }}
                        className="px-2.5 py-1.5 text-xs font-black bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl border border-rose-800 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        値引き取消 (0円)
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDiscountForm(false)}
                    className="text-xs text-stone-400 hover:text-stone-200 self-end md:self-auto cursor-pointer font-medium"
                  >
                    ✕ パネルを閉じる
                  </button>
                </div>

                {/* 中段①: パーセント(%)クイックボタン */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-800/60">
                  <span className="text-[11px] font-black text-stone-400 flex items-center gap-1 shrink-0">
                    <Percent className="w-3 h-3 text-amber-500" />
                    ％値引き:
                  </span>
                  {[5, 10, 15, 20, 30, 50].map((pct) => {
                    const amt = Math.round(subtotal * (pct / 100));
                    const isCurrentPct = subtotal > 0 && discountAmount === amt;
                    return (
                      <button
                        type="button"
                        key={pct}
                        onClick={() => {
                          setDiscountAmount(amt);
                          setDiscountReason(`${pct}% OFF`);
                        }}
                        className={`px-2.5 py-1 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                          isCurrentPct
                            ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md scale-105"
                            : "bg-stone-900 hover:bg-stone-800 text-amber-300 border-stone-700 hover:border-amber-500/50"
                        }`}
                      >
                        {pct}% OFF <span className="text-[10px] font-normal text-stone-400">(-¥{amt.toLocaleString()})</span>
                      </button>
                    );
                  })}
                </div>

                {/* 中段②: 金額加算クイックボタン（クリックするたびに加算！） */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-800/60">
                  <span className="text-[11px] font-black text-stone-400 flex items-center gap-1 shrink-0">
                    <Plus className="w-3 h-3 text-emerald-400" />
                    金額加算 (押すたび加算):
                  </span>

                  {/* 端数切捨ボタン */}
                  {subtotal % 1000 > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const fraction = subtotal % 1000;
                        setDiscountAmount((prev) => Math.min(subtotal, prev + fraction));
                        setDiscountReason("千円未満切捨");
                      }}
                      className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white rounded-xl border border-stone-700 cursor-pointer shadow-xs transition-all"
                    >
                      千円未満切捨 (+¥{(subtotal % 1000).toLocaleString()})
                    </button>
                  )}
                  {subtotal % 10000 > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const fraction = subtotal % 10000;
                        setDiscountAmount((prev) => Math.min(subtotal, prev + fraction));
                        setDiscountReason("万円未満切捨");
                      }}
                      className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white rounded-xl border border-stone-700 cursor-pointer shadow-xs transition-all"
                    >
                      万円未満切捨 (+¥{(subtotal % 10000).toLocaleString()})
                    </button>
                  )}

                  {/* 5,000円, 10,000円, 20,000円, 50,000円, 100,000円 */}
                  {[5000, 10000, 20000, 50000, 100000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        setDiscountAmount((prev) => Math.min(subtotal, prev + amt));
                      }}
                      className="px-2.5 py-1 text-xs font-black bg-stone-900 hover:bg-stone-800 active:scale-95 text-stone-100 hover:text-amber-300 rounded-xl border border-stone-700 hover:border-amber-500/60 cursor-pointer shadow-xs transition-all"
                    >
                      +{amt >= 10000 ? `${amt / 10000}万` : amt.toLocaleString()}円
                    </button>
                  ))}
                </div>

                {/* 下段: 値引き理由・メモ & クイック選択タグ */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-stone-800/60">
                  <span className="text-[11px] text-stone-400 font-bold shrink-0">値引き理由（任意）:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {["端数サービス", "常連様割引", "まとめ買い割", "キャンペーン", "タイムセール"].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setDiscountReason(tag)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer border ${
                          discountReason === tag
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="自由入力..."
                    className="text-xs bg-stone-900 px-2.5 py-1 rounded-lg border border-stone-800 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 flex-1 max-w-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 通知メッセージ */}
          {notification && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                notification.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-stone-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* 直前のクラフト作成 取り消しバー */}
          {lastCraft && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 text-amber-300">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  直前に作成した商品: <strong className="text-white underline">{lastCraft.names.join("、")}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRollbackLastCraft}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>作成を取り消す (在庫・素材を戻す)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLastCraft(null)}
                  className="text-stone-400 hover:text-white text-xs px-2 py-1"
                  title="閉じる"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* スクロールコンテンツ領域（商品一覧 & 売上伝票履歴） */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-16">
        {/* 商品一覧（画像1の「商品名」「個数」レイアウト ＆ 画像2の [0][1][10][100] ボタン） */}
        <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Boxes className="w-4 h-4 text-rose-500" />
            【{currentShopInfo.name}】商品一覧 ({currentShopProducts.length}点)
          </h2>
          <span className="text-[11px] text-stone-400">
            ※「作成」を押すと必要な素材が自動で消費されます
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {currentShopProducts.map((item) => {
            const currentQty = quantities[item.id] || 0;
            const itemSubtotal = item.selling_price * currentQty;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  currentQty > 0
                    ? "bg-stone-800/90 border-rose-500/50 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30"
                    : "bg-stone-900/60 border-stone-800 hover:border-stone-700"
                }`}
              >
                {/* 左側: 写真・品名・価格・現在庫・必要素材レシピ */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* サムネイル */}
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover border border-stone-700 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0 text-stone-500 text-xs">
                      No Photo
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                        {item.name}
                      </h3>
                      <span className="text-xs font-black text-rose-400">
                        {formatCurrency(item.selling_price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs mt-1">
                      {storeSettings.enableInventory ? (
                        <span className="text-stone-400">
                          現在庫:{" "}
                          <strong
                            className={`font-black ${
                              item.current_stock > 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {item.current_stock}
                          </strong>{" "}
                          {item.unit}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                          在庫無制限 (販売可)
                        </span>
                      )}

                      {/* 選択中の小計 */}
                      {currentQty > 0 && (
                        <span className="text-rose-300 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                          小計: {formatCurrency(itemSubtotal)}
                        </span>
                      )}
                    </div>

                    {/* レシピ素材バッジ（1つ作るのに必要な素材） */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[10px] text-stone-500 font-bold">必要素材:</span>
                      {item.recipe && item.recipe.length > 0 ? (
                        item.recipe.map((req, idx) => {
                          const ingItem = ingredients.find((i) => i.id === req.ingredient_id);
                          const ingStock = ingItem ? ingItem.current_stock : 0;
                          const isShort = ingStock < req.quantity * (currentQty || 1);

                          return (
                            <span
                              key={idx}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium border flex items-center gap-1 ${
                                isShort && currentQty > 0
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : "bg-stone-800 text-stone-300 border-stone-700"
                              }`}
                            >
                              <span>
                                {req.ingredient_name} × {req.quantity}
                              </span>
                              <span className="text-[9px] text-stone-500">
                                (在庫:{ingStock})
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-stone-500 italic">
                          素材不要 (レシピ未設定)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右側: 個数入力 & 添付画像2のボタン [0] [1] [10] [100] */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-stretch md:self-auto justify-end">
                  {/* 直接手入力欄 & 微調整ボタン */}
                  <div className="flex items-center bg-stone-950 rounded-xl border border-stone-700 p-1">
                    <button
                      type="button"
                      onClick={() => handleSetQuantity(item.id, currentQty - 1)}
                      className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={currentQty === 0 ? "" : currentQty}
                      onChange={(e) =>
                        handleSetQuantity(item.id, parseInt(e.target.value, 10) || 0)
                      }
                      placeholder="0"
                      className="w-16 text-center font-black text-white text-base bg-transparent focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleSetQuantity(item.id, currentQty + 1)}
                      className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 添付画像2のクイック加算ボタン群 [0] [1] [10] [100] */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 10, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleQuickAdd(item.id, num)}
                        className={`w-11 h-10 rounded-xl border font-black text-sm transition-all shadow-md active:scale-95 flex items-center justify-center cursor-pointer ${
                          num === 0
                            ? "bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300"
                            : "bg-stone-800 hover:bg-stone-700 border-stone-600 hover:border-rose-500 text-white"
                        }`}
                        title={num === 0 ? "個数を0にリセット" : `+${num} 個加算`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      </div>
    </div>
  );
}
