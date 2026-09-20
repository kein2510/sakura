"use client";

import React, { useState } from "react";
import { X, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { ItemType } from "@/types";
import ImageUploader from "./ImageUploader";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: ItemType;
}

export default function ProductModal({ isOpen, onClose, defaultType = "product" }: ProductModalProps) {
  const { addItem } = useApp();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<ItemType>(defaultType);
  const [categoryName, setCategoryName] = useState("寿司・刺身");
  const [unit, setUnit] = useState(defaultType === "product" ? "人前" : "kg");
  const [initialStock, setInitialStock] = useState<number>(10);
  const [optimalStock, setOptimalStock] = useState<number>(20);
  const [alertThreshold, setAlertThreshold] = useState<number>(5);
  const [costPrice, setCostPrice] = useState<number>(1000);
  const [sellingPrice, setSellingPrice] = useState<number>(defaultType === "product" ? 2800 : 0);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  if (!isOpen) return null;

  const handleSelectPresetImage = (url: string) => {
    setImageUrl(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addItem({
      code: code || `ITM-${Date.now().toString().slice(-4)}`,
      name,
      category_id: type === "product" ? "cat-1" : "cat-5",
      category_name: categoryName,
      type,
      unit,
      current_stock: initialStock,
      optimal_stock: optimalStock,
      alert_threshold: alertThreshold,
      cost_price: costPrice,
      selling_price: type === "product" ? sellingPrice : 0,
      image_url: imageUrl || "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop",
    });

    setSuccessMessage(`${name} を新規登録しました！`);
    setTimeout(() => {
      setSuccessMessage("");
      setName("");
      setCode("");
      setImageUrl("");
      onClose();
    }, 1200);
  };

  // 原価率計算
  const costRatio = type === "product" && sellingPrice > 0 ? ((costPrice / sellingPrice) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">商品・仕入れ素材の新規登録</h2>
              <p className="text-xs text-stone-500">料理写真・食材パッケージ画像の登録と原価計算</p>
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
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-stone-900">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
            {/* 種別（料理 or 素材） */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-stone-700">登録区分:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType("product");
                    setUnit("人前");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    type === "product"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  🍱 新商品（販売料理）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("ingredient");
                    setUnit("kg");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    type === "ingredient"
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  📦 仕入れ素材・原材料
                </button>
              </div>
            </div>

            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  品名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={type === "product" ? "例: 特選 桜鯛のしゃぶしゃぶ鍋" : "例: 国産黒毛和牛サーロイン"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  管理コード (SKU)
                </label>
                <input
                  type="text"
                  placeholder={type === "product" ? "PRD-006" : "ING-006"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* カテゴリ & 単位 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  カテゴリ
                </label>
                <select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                >
                  {type === "product" ? (
                    <>
                      <option value="寿司・刺身">寿司・刺身</option>
                      <option value="肉料理・鍋">肉料理・鍋</option>
                      <option value="揚げ物・焼物">揚げ物・焼物</option>
                      <option value="日本酒・飲料">日本酒・飲料</option>
                      <option value="甘味・デザート">甘味・デザート</option>
                    </>
                  ) : (
                    <>
                      <option value="鮮魚・水産素材">鮮魚・水産素材</option>
                      <option value="精肉・畜産素材">精肉・畜産素材</option>
                      <option value="調味料・乾物・米">調味料・乾物・米</option>
                      <option value="青果・野菜">青果・野菜</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  管理単位
                </label>
                <input
                  type="text"
                  placeholder="人前, 個, kg, 尾, 帖, 瓶など"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                />
              </div>
            </div>

            {/* 画像アップロードエリア（重要要件） */}
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
              <ImageUploader
                currentImageUrl={imageUrl}
                onImageUploaded={(url) => setImageUrl(url)}
                label="商品・素材写真のアップロード (ドラッグ＆ドロップまたはタップ)"
              />

              {/* サンプルプリセット選択 */}
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
                <span>またはサンプル写真を選ぶ:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectPresetImage(
                      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop"
                    )
                  }
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-rose-600 hover:bg-rose-50"
                >
                  🍣 特上寿司
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectPresetImage(
                      "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=300&fit=crop"
                    )
                  }
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-rose-600 hover:bg-rose-50"
                >
                  🥩 黒毛和牛
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSelectPresetImage(
                      "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop"
                    )
                  }
                  className="px-2 py-0.5 rounded bg-white border border-stone-200 text-rose-600 hover:bg-rose-50"
                >
                  🐟 鮮魚造り
                </button>
              </div>
            </div>

            {/* 価格・原価設定 & 原価率自動計算 */}
            <div className="grid grid-cols-3 gap-3">
              {type === "product" && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    販売価格（税込）
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(Number(e.target.value))}
                      className="w-full text-xs font-bold px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                    />
                    <span className="absolute right-2.5 top-2 text-xs text-stone-400">円</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  仕入れ原価
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full text-xs font-bold px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                  />
                  <span className="absolute right-2.5 top-2 text-xs text-stone-400">円</span>
                </div>
              </div>

              {type === "product" && costRatio && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    推定原価率
                  </label>
                  <div
                    className={`px-3 py-2 rounded-lg border text-xs font-extrabold flex items-center justify-between ${
                      Number(costRatio) > 40
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    <span>{costRatio}%</span>
                    <span className="text-[10px] font-normal">
                      {Number(costRatio) > 40 ? "高め" : "適正"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 在庫・発注点設定 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  初期在庫数
                </label>
                <input
                  type="number"
                  value={initialStock}
                  onChange={(e) => setInitialStock(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  適正在庫数
                </label>
                <input
                  type="number"
                  value={optimalStock}
                  onChange={(e) => setOptimalStock(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 bg-stone-50 rounded-lg border border-stone-300"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-rose-700 block mb-1">
                  発注アラート閾値
                </label>
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 bg-rose-50/50 rounded-lg border border-rose-300 text-rose-900 font-bold"
                />
              </div>
            </div>

            {/* フッター */}
            <div className="pt-3 flex gap-2 border-t border-stone-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md shadow-rose-900/20"
              >
                {type === "product" ? "新商品を登録する" : "素材を登録する"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
