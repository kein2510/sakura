"use client";

import React, { useState } from "react";
import { X, ArrowDownRight, ArrowUpRight, AlertTriangle, Scale, CheckCircle2, Package } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { TransactionType } from "@/types";

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultItemId?: string;
}

export default function InventoryModal({ isOpen, onClose, defaultItemId }: InventoryModalProps) {
  const { items, recordStockTransaction } = useApp();
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || (items[0]?.id ?? ""));
  const [type, setType] = useState<TransactionType>("inbound");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.id === selectedItemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || quantity <= 0) return;

    recordStockTransaction({
      itemId: selectedItemId,
      type,
      quantity,
      reason: reason || (type === "inbound" ? "定期仕入れ入庫" : type === "waste" ? "賞味期限切れ廃棄" : "調理仕込み出庫"),
    });

    setSuccessMessage(`${currentItem.name} の在庫を更新しました！`);
    setTimeout(() => {
      setSuccessMessage("");
      setQuantity(1);
      setReason("");
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-stone-900 rounded-2xl shadow-2xl border border-stone-800 w-full max-w-lg overflow-hidden text-white">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">在庫・受発注 入出庫登録</h2>
              <p className="text-xs text-stone-400">入出庫・廃棄・棚卸調整をリアルタイムに反映します</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-950/80 text-emerald-400 flex items-center justify-center border border-emerald-800/60">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-white">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 対象品目選択 */}
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">
                対象品目（商品または仕入れ素材）
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-stone-950 text-white rounded-lg border border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <optgroup label="仕入れ原材料・素材">
                  {items
                    .filter((i) => i.type === "ingredient")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}（現在庫: {item.current_stock} {item.unit}）
                      </option>
                    ))}
                </optgroup>
                <optgroup label="販売料理商品">
                  {items
                    .filter((i) => i.type === "product")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}（現在庫: {item.current_stock} {item.unit}）
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* トランザクション区分 */}
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1.5">
                処理区分
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "inbound", label: "仕入入庫", icon: ArrowDownRight, color: "emerald" },
                  { id: "outbound", label: "仕込出庫", icon: ArrowUpRight, color: "blue" },
                  { id: "waste", label: "廃棄ロス", icon: AlertTriangle, color: "rose" },
                  { id: "adjust", label: "棚卸調整", icon: Scale, color: "amber" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id as TransactionType)}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      type === t.id
                        ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-xs"
                        : "border-stone-800 bg-stone-950 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 数量入力 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  {type === "adjust" ? "棚卸後の実在庫数" : "変動数量"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm font-bold px-3 py-2 bg-stone-950 text-white rounded-lg border border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-stone-400 shrink-0">
                    {currentItem?.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">
                  処理後の推定在庫
                </label>
                <div className="px-3 py-2 bg-stone-950 rounded-lg border border-stone-800 text-sm font-bold text-amber-400">
                  {type === "inbound"
                    ? ((currentItem?.current_stock || 0) + quantity).toFixed(1)
                    : type === "outbound" || type === "waste"
                    ? Math.max(0, (currentItem?.current_stock || 0) - quantity).toFixed(1)
                    : quantity.toFixed(1)}{" "}
                  <span className="text-xs font-normal text-stone-400">{currentItem?.unit}</span>
                </div>
              </div>
            </div>

            {/* 理由・伝票番号 */}
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">
                理由・仕入先伝票メモ
              </label>
              <input
                type="text"
                placeholder="例: 市場納品、宴会仕込み用、廃棄など"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-stone-950 text-white rounded-lg border border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-stone-500"
              />
            </div>

            {/* アクションボタン */}
            <div className="pt-3 flex gap-2 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-stone-700 text-xs font-bold text-stone-300 hover:bg-stone-800 cursor-pointer transition-colors"
              >
                閉じる
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-md shadow-amber-950/40 cursor-pointer transition-colors"
              >
                在庫を反映する
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
