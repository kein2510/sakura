"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Loader2, RefreshCw, X, Link as LinkIcon } from "lucide-react";
import { uploadImage } from "@/lib/storage";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  label?: string;
  dark?: boolean;
}

export default function ImageUploader({
  currentImageUrl,
  onImageUploaded,
  label = "画像をアップロード",
  dark = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || "");
  const [prevImageUrl, setPrevImageUrl] = useState(currentImageUrl);

  if (currentImageUrl !== prevImageUrl) {
    setPrevImageUrl(currentImageUrl);
    setPreviewUrl(currentImageUrl || "");
  }

  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl("");
    onImageUploaded("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {label && (
          <label className={`text-xs font-bold block ${dark ? "text-stone-300" : "text-stone-700"}`}>
            {label}
          </label>
        )}
        <div className="flex items-center gap-2">
          {previewUrl && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              画像を削除
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] font-bold text-stone-400 hover:text-stone-200 cursor-pointer flex items-center gap-1"
          >
            <LinkIcon className="w-3 h-3" />
            {showUrlInput ? "URL入力を閉じる" : "URLで直接指定"}
          </button>
        </div>
      </div>

      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={previewUrl}
            onChange={(e) => {
              setPreviewUrl(e.target.value);
              onImageUploaded(e.target.value);
            }}
            placeholder="https://... または /logo.png"
            className={`flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              dark
                ? "bg-stone-950 border-stone-700 text-white focus:border-amber-500"
                : "bg-white border-stone-300 text-stone-900 focus:border-rose-500"
            }`}
          />
        </div>
      )}

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
            ? "border-amber-500 bg-amber-500/10 scale-[1.01]"
            : dark
            ? "border-stone-700 hover:border-amber-500 bg-stone-950/60 hover:bg-stone-950"
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
            <Loader2 className={`w-8 h-8 animate-spin ${dark ? "text-amber-400" : "text-rose-600"}`} />
            <p className={`text-xs font-bold ${dark ? "text-stone-300" : "text-stone-700"}`}>
              クラウドにアップロード中...
            </p>
          </div>
        ) : previewUrl ? (
          <div className="relative w-full group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded"
              className={`w-full h-36 object-contain rounded-xl border shadow-xs ${
                dark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white"
              }`}
            />
            <div className="absolute inset-0 bg-stone-950/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold backdrop-blur-xs">
              <RefreshCw className="w-4 h-4" />
              写真を変更する (クリックまたはドラッグ)
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-4">
            <div
              className={`p-3 rounded-full mb-1 ${
                dark
                  ? "bg-stone-900 border border-stone-800 text-amber-400"
                  : "bg-rose-100 text-rose-600"
              }`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className={`text-xs font-bold ${dark ? "text-stone-200" : "text-stone-800"}`}>
              クリックして写真を選択、またはドラッグ＆ドロップ
            </p>
            <p className="text-[11px] text-stone-400">
              スマートフォンでの撮影写真、JPG、PNG、WEBP対応 (クラウド自動最適化)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

