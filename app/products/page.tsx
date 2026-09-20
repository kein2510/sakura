"use client";

import React, { useState } from "react";
import {
  Image as ImageIcon,
  Plus,
  Search,
  UploadCloud,
  Camera,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import ProductModal from "@/components/ProductModal";
import ImageUploader from "@/components/ImageUploader";
import { ItemType, Item } from "@/types";

export default function ProductsPage() {
  const { items, updateItemImage } = useApp();
  const [selectedType, setSelectedType] = useState<ItemType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<ItemType>("product");

  // 写真差し替えモーダル用
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesType = selectedType === "all" || item.type === selectedType;
    const matchesQuery =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category_name && item.category_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesQuery;
  });

  const handleOpenAddModal = (type: ItemType) => {
    setModalDefaultType(type);
    setIsModalOpen(true);
  };

  const handleSavePhotoChange = (newUrl: string) => {
    if (editingItem) {
      updateItemImage(editingItem.id, newUrl);
      setEditingItem(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-12">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              商品・素材 画像ギャラリー管理
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
              Supabase Storage連携
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            新商品の完成料理写真や、産地直送の仕入れ食材パッケージ画像・原価率管理
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal("ingredient")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-stone-700 hover:bg-stone-50 border border-stone-300 shadow-xs transition-all"
          >
            <UploadCloud className="w-4 h-4 text-amber-600" />
            仕入れ素材を登録
          </button>
          <button
            onClick={() => handleOpenAddModal("product")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-900/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            新商品を登録
          </button>
        </div>
      </div>

      {/* フィルター & 検索 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedType === "all" ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            すべての画像 ({items.length})
          </button>
          <button
            onClick={() => setSelectedType("product")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedType === "product" ? "bg-white text-rose-700 shadow-xs" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            🍱 完成料理・商品 ({items.filter((i) => i.type === "product").length})
          </button>
          <button
            onClick={() => setSelectedType("ingredient")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedType === "ingredient" ? "bg-white text-amber-800 shadow-xs" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            📦 仕入れ素材・原材料 ({items.filter((i) => i.type === "ingredient").length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="品名やコードで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs pl-8 pr-3 py-1.5 bg-stone-50 rounded-lg border border-stone-300 focus:ring-2 focus:ring-rose-500 w-64"
          />
        </div>
      </div>

      {/* 画像カードグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredItems.map((item) => {
          const costRatio =
            item.type === "product" && item.selling_price > 0 && item.cost_price !== undefined
              ? Math.round((item.cost_price / item.selling_price) * 100)
              : null;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
            >
              {/* 画像エリア（直接変更可能） */}
              <div className="relative h-44 bg-stone-100 overflow-hidden">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                    <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                    <span className="text-xs">画像未登録</span>
                  </div>
                )}

                {/* 写真差し替えオーバーレイボタン (重要要件) */}
                <button
                  type="button"
                  onClick={() => setEditingItem(item)}
                  className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-xs cursor-pointer"
                >
                  <Camera className="w-6 h-6 text-white" />
                  写真をアップロード・変更
                </button>

                {/* バッジ（種別） */}
                <span
                  className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-xs pointer-events-none ${
                    item.type === "product"
                      ? "bg-rose-600 text-white"
                      : "bg-amber-600 text-white"
                  }`}
                >
                  {item.type === "product" ? "料理" : "素材"}
                </span>

                {/* 在庫ステータス */}
                <span
                  className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs backdrop-blur-xs pointer-events-none ${
                    item.current_stock <= (item.alert_threshold ?? 5)
                      ? "bg-rose-600/90 text-white"
                      : "bg-stone-900/70 text-white"
                  }`}
                >
                  残: {item.current_stock} {item.unit}
                </span>
              </div>

              {/* カード本文 */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                    <span>{item.category_name}</span>
                    <span className="font-mono">{item.code}</span>
                  </div>
                  <h3 className="font-bold text-sm text-stone-900 line-clamp-1 group-hover:text-rose-600 transition-colors">
                    {item.name}
                  </h3>
                </div>

                {/* 価格・原価情報 & 写真変更クイックリンク */}
                <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
                  {item.type === "product" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">販売価格</span>
                        <span className="font-extrabold text-stone-900 text-sm">
                          {formatCurrency(item.selling_price)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-400">原価 / 原価率</span>
                        <span className="font-semibold text-stone-600">
                          {formatCurrency(item.cost_price ?? 0)} ({costRatio}%)
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">仕入単価</span>
                      <span className="font-extrabold text-amber-900 text-sm">
                        {formatCurrency(item.cost_price ?? 0)} / {item.unit}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="w-full mt-2 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-stone-500" />
                    写真・素材画像を変更
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 新規商品登録モーダル */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultType={modalDefaultType}
      />

      {/* 写真クイック差し替えモーダル */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  {editingItem.name} の写真変更
                </h3>
                <p className="text-[11px] text-stone-500">
                  スマートフォンやPCの写真を選択してアップロードできます
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ImageUploader
              currentImageUrl={editingItem.image_url}
              onImageUploaded={handleSavePhotoChange}
              label="新しい写真ファイルを選択またはドロップ"
            />

            <div className="mt-4 pt-3 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
