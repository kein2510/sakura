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
  History,
  User,
  Store,
  Radio,
  Trash2,
  Undo2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { ShopId, SHOPS } from "@/types";
import { supabase } from "@/lib/supabase";

export default function MainPage() {
  const { items, products, ingredients, sellProducts, craftProducts, sales, users, refreshData, cancelSale, rollbackCraftItems } = useApp();

  // 現在選択中の店舗 ("sakura" | "buon_viaggio")
  const [selectedShopId, setSelectedShopId] = useState<ShopId>("sakura");

  // 各商品の選択個数ステート { [itemId]: number }
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
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

  // 売上履歴のフィルター
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [selectedShopFilter, setSelectedShopFilter] = useState<string>("all");

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
    setNotification(null);
  };

  // 店舗切り替え
  const handleSwitchShop = (shopId: ShopId) => {
    if (selectedShopId !== shopId) {
      setSelectedShopId(shopId);
      setQuantities({}); // 店舗が変わったら選択個数はリセット
      setNotification(null);
    }
  };

  // 合計金額の計算 (選択中店舗の 数量 × 単価)
  const totalAmount = currentShopProducts.reduce((sum, item) => {
    const qty = quantities[item.id] || 0;
    return sum + item.selling_price * qty;
  }, 0);

  // 合計個数の計算
  const totalItemsCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  // 「売る」実行
  const handleSell = () => {
    if (totalItemsCount === 0) {
      setNotification({ type: "error", message: "販売する商品の個数を指定してください。" });
      return;
    }

    const result = sellProducts(quantities, selectedShopId);
    if (result.success) {
      setNotification({ type: "success", message: result.message });
      setQuantities({});
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

  // 売上伝票を取り消す（販売在庫復元 ＆ 金庫店舗入金分の減額）
  const handleCancelSale = async (saleId: string, amount: number) => {
    if (
      window.confirm(
        `この売上伝票を取り消しますか？\n伝票ID: ${saleId} (金額: ${formatCurrency(amount)})\n\n・販売した商品の在庫が元の個数に戻ります\n・金庫に入金された売上金（店舗手元残り70%）が自動で戻されます`
      )
    ) {
      const result = await cancelSale(saleId);
      if (result.success) {
        setNotification({ type: "success", message: result.message });
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

          {/* ② 合計金額 & 売る・作成アクションバー（完全不透明 bg-stone-900） */}
          <div className="bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
            {/* 左側: ロゴ & 合計金額表示 */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-3">
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
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-stone-400 block">
                      【{currentShopInfo.name}】選択中 ({totalItemsCount}点)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-stone-400">合計:</span>
                    <span
                      className={`text-2xl sm:text-3xl font-black tracking-tight ${
                        selectedShopId === "sakura" ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {totalItemsCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-200 px-2.5 py-1.5 rounded-lg bg-stone-800 border border-stone-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  クリア
                </button>
              )}
            </div>

            {/* 右側: 「売る」ボタン ＆ 「作成 (在庫増)」ボタン */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* 売るボタン */}
              <button
                type="button"
                onClick={handleSell}
                disabled={totalItemsCount === 0}
                className="flex-1 md:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-sm text-white shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-5 h-5" />
                <span>売る (在庫減算)</span>
              </button>

              {/* 作成ボタン (在庫を作った時のボタン) */}
              <button
                type="button"
                onClick={handleCraft}
                disabled={totalItemsCount === 0}
                className="flex-1 md:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-sm text-white shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <Hammer className="w-5 h-5" />
                <span>作成 (在庫増 ＆ 素材消費)</span>
              </button>
            </div>
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

      {/* ========================================================
          📜 従業員別 売上伝票・販売履歴セクション
      ======================================================== */}
      <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 shadow-2xl text-white space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <History className="w-5 h-5 text-rose-500" />
              従業員別 売上伝票・販売履歴
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              誰がいつ・どの店舗で商品を販売したかのリアルタイム伝票履歴です（ボーナス査定の対象）
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* 店舗フィルター */}
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setSelectedShopFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedShopFilter === "all"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                全店舗
              </button>
              <button
                type="button"
                onClick={() => setSelectedShopFilter("sakura")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedShopFilter === "sakura"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🌸 さくら
              </button>
              <button
                type="button"
                onClick={() => setSelectedShopFilter("buon_viaggio")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedShopFilter === "buon_viaggio"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🍷 Buon viaggio
              </button>
            </div>

            {/* スタッフ絞り込みフィルター */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-stone-950 p-1.5 rounded-2xl border border-stone-800 max-w-full">
              <button
                type="button"
                onClick={() => setSelectedStaffFilter("all")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedStaffFilter === "all"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                全員
              </button>
              {users.map((u) => {
                const count = sales.filter(
                  (s) => s.staffUserId === u.id || s.staffName === u.displayName || s.staff_name === u.displayName
                ).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedStaffFilter(u.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                      selectedStaffFilter === u.id
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-stone-400 hover:text-white"
                    }`}
                  >
                    <User className="w-3 h-3" />
                    {u.displayName} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 伝票リスト */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {(() => {
            const filteredSales = sales.filter((s) => {
              // 店舗フィルター
              if (selectedShopFilter !== "all" && (s.shopId || "sakura") !== selectedShopFilter) {
                return false;
              }
              // スタッフフィルター
              if (selectedStaffFilter === "all") return true;
              const targetUser = users.find((u) => u.id === selectedStaffFilter);
              if (!targetUser) return true;
              return (
                s.staffUserId === targetUser.id ||
                s.staffName === targetUser.displayName ||
                s.staff_name === targetUser.displayName
              );
            });

            if (filteredSales.length === 0) {
              return (
                <p className="text-xs text-stone-500 py-8 text-center bg-stone-950/40 rounded-2xl border border-stone-800/60">
                  該当する売上伝票はありません
                </p>
              );
            }

            return filteredSales.map((sale) => {
              const saleShop = sale.shopId === "buon_viaggio" ? "buon_viaggio" : "sakura";
              const isBV = saleShop === "buon_viaggio";

              return (
                <div
                  key={sale.id}
                  className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/80 hover:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-stone-400">
                        #{sale.id}
                      </span>
                      {/* 店舗バッジ */}
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          isBV
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {isBV ? "🍷 Buon viaggio" : "🌸 和食さくら"}
                      </span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        担当: {sale.staffName || sale.staff_name || "店員"}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {new Date(sale.created_at).toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* 販売商品リスト */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sale.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-700/80 text-[11px] font-semibold text-stone-300"
                        >
                          {it.itemName || it.item_name}{" "}
                          <strong className={isBV ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            ×{it.quantity}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 合計売上金額 ＆ 取消ボタン */}
                  <div className="flex items-center gap-3">
                    <div className="text-right sm:text-right">
                      <span className="text-[10px] text-stone-400 block">売上金額</span>
                      <span
                        className={`text-lg font-black ${
                          isBV ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(sale.totalAmount ?? sale.total_amount ?? 0)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelSale(sale.id, sale.totalAmount ?? sale.total_amount ?? 0)}
                      title="この売上伝票を取り消す（在庫・金庫残高を元に戻す）"
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 active:scale-95 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">取消</span>
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  </div>
  );
}
