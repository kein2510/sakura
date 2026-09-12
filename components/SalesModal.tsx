"use client";

import React, { useState } from "react";
import { X, Plus, Minus, Trash2, CheckCircle2, ShoppingBag, CreditCard, Banknote, QrCode } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface SalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SalesModal({ isOpen, onClose }: SalesModalProps) {
  const { items, addSale } = useApp();
  const productItems = items.filter((i) => i.type === "product");

  const [selectedItems, setSelectedItems] = useState<{ itemId: string; quantity: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  if (!isOpen) return null;

  const handleAddItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.itemId === itemId);
      if (existing) {
        return prev.map((item) =>
          item.itemId === itemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { itemId, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((item) => {
          if (item.itemId === itemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { itemId: string; quantity: number }[]
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  const subtotal = selectedItems.reduce((sum, sel) => {
    const item = items.find((i) => i.id === sel.itemId);
    return sum + (item ? item.selling_price * sel.quantity : 0);
  }, 0);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) return;

    const newSale = await addSale({
      items: selectedItems,
      paymentMethod,
      discountAmount,
      notes,
    });

    setSuccessMessage(`売上伝票（${newSale.id}）を登録し、在庫をリアルタイム更新しました！`);
    setTimeout(() => {
      setSuccessMessage("");
      setSelectedItems([]);
      setNotes("");
      setDiscountAmount(0);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">新規売上伝票入力</h2>
              <p className="text-xs text-stone-500">注文内容を登録すると、リアルタイムで売上と在庫が連動します</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <p className="text-lg font-bold text-stone-900">{successMessage}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
            {/* 左側: 商品選択パネル (7カラム) */}
            <div className="md:col-span-7 p-5 border-r border-stone-200 overflow-y-auto max-h-[calc(90vh-140px)]">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                メニューから料理を選択
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {productItems.map((prod) => {
                  const isSelected = selectedItems.some((s) => s.itemId === prod.id);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddItem(prod.id)}
                      className={`text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? "border-rose-500 bg-rose-50/50 shadow-xs ring-1 ring-rose-500"
                          : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {prod.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-12 h-12 rounded-lg object-cover border border-stone-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center shrink-0 text-stone-400 text-xs">
                            写真なし
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 line-clamp-1">{prod.name}</p>
                          <p className="text-[11px] text-stone-500">{prod.category_name}</p>
                          <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                            現在庫: {prod.current_stock} {prod.unit}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-600">
                          {formatCurrency(prod.selling_price)}
                        </span>
                        <span className="text-[11px] font-medium text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <Plus className="w-3 h-3" /> 追加
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右側: 注文内容・決済情報 (5カラム) */}
            <form onSubmit={handleSubmit} className="md:col-span-5 p-5 flex flex-col justify-between bg-stone-50/60 overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                  伝票明細 ({selectedItems.length}品)
                </h3>

                {selectedItems.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-xl text-stone-400 text-xs">
                    左側のメニューから料理をタップして伝票に追加してください
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {selectedItems.map((sel) => {
                      const item = items.find((i) => i.id === sel.itemId);
                      if (!item) return null;
                      return (
                        <div
                          key={sel.itemId}
                          className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-bold text-stone-800 truncate">{item.name}</p>
                            <p className="text-stone-500">
                              {formatCurrency(item.selling_price)} × {sel.quantity} ={" "}
                              <span className="font-semibold text-stone-900">
                                {formatCurrency(item.selling_price * sel.quantity)}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(sel.itemId, -1)}
                              className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center font-bold text-stone-900">{sel.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(sel.itemId, 1)}
                              className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(sel.itemId)}
                              className="w-6 h-6 rounded hover:bg-rose-50 flex items-center justify-center text-stone-400 hover:text-rose-600 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 決済方法選択 */}
                <div className="mt-4 pt-3 border-t border-stone-200">
                  <label className="text-xs font-semibold text-stone-700 block mb-1.5">
                    決済方法
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "credit", label: "クレジットカード", icon: CreditCard },
                      { id: "qr", label: "QR / 電子マネー", icon: QrCode },
                      { id: "cash", label: "現金", icon: Banknote },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[11px] font-medium transition-all ${
                          paymentMethod === m.id
                            ? "border-rose-600 bg-rose-50 text-rose-700 font-bold"
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
                        }`}
                      >
                        <m.icon className="w-4 h-4 mb-1" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 席番号・メモ */}
                <div className="mt-3">
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    席番号 / 伝票メモ
                  </label>
                  <input
                    type="text"
                    placeholder="例: テーブル3番、カウンター、お土産等"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* 合計金額・確定ボタン */}
              <div className="mt-4 pt-3 border-t border-stone-300">
                <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                  <span>小計</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-extrabold text-stone-900 mb-4">
                  <span>合計（税込）</span>
                  <span className="text-xl text-rose-600">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={selectedItems.length === 0}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-xs font-bold text-white transition-all shadow-md shadow-rose-900/20"
                  >
                    売上確定（即時同期）
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
