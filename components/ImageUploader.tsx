"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { uploadImage } from "@/lib/storage";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  label?: string;
}

export default function ImageUploader({
  currentImageUrl,
  onImageUploaded,
  label = "画像をアップロード",
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || "");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("画像ファイル（PNG、JPG、WEBPなど）を選択してください。");
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      setPreviewUrl(uploadedUrl);
      onImageUploaded(uploadedUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("画像のアップロードに失敗しました。");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold text-stone-700 block">{label}</label>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 overflow-hidden flex flex-col items-center justify-center min-h-[140px] ${
          isDragOver
            ? "border-rose-500 bg-rose-50/60 scale-[1.01]"
            : "border-stone-300 hover:border-rose-400 bg-stone-50/60 hover:bg-stone-50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
            <p className="text-xs font-bold text-stone-700">クラウドにアップロード中...</p>
          </div>
        ) : previewUrl ? (
          <div className="relative w-full group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded"
              className="w-full h-36 object-cover rounded-xl border border-stone-200 shadow-xs"
            />
            <div className="absolute inset-0 bg-stone-950/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold backdrop-blur-xs">
              <RefreshCw className="w-4 h-4" />
              写真を変更する (クリックまたはドラッグ)
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-4">
            <div className="p-3 rounded-full bg-rose-100 text-rose-600 mb-1">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-stone-800">
              クリックして写真を選択、またはドラッグ＆ドロップ
            </p>
            <p className="text-[11px] text-stone-400">
              スマートフォンでの撮影写真、JPG、PNG、WEBP対応 (自動最適化)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
