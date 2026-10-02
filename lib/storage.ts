import { supabase } from "./supabase";

/**
 * クライアント側（ブラウザ）で画像を最大幅/高さ 400px、JPEG品質0.75に自動リサイズ・圧縮する関数
 * これにより高画質・巨大な写真でも10〜25KB前後に軽量化され、ブラウザ容量制限や通信遅延を防ぎます。
 */
export async function compressImageFile(
  file: File,
  maxDimension = 400,
  quality = 0.75
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window is not defined"));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context is not available"));
        return;
      }

      // 透過を維持して描画（白背景で塗りつぶさない）
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // WebP はアルファ透過チャンネルを完全保持したままJPEG同等の高圧縮が可能
      let mimeType = "image/webp";
      let dataUrl = canvas.toDataURL("image/webp", quality);

      // 万一ブラウザがWebP未対応でPNGフォールバックした場合の検証
      if (!dataUrl.startsWith("data:image/webp")) {
        // PNGとして出力（透過保持）
        mimeType = "image/png";
        dataUrl = canvas.toDataURL("image/png");
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, dataUrl });
          } else {
            resolve({ blob: file, dataUrl });
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * 画像ファイルを自動圧縮してからSupabase Storageにアップロードする、
 * または軽量Base64 Data URLとして読み込んで返す関数
 */
export async function uploadImage(file: File): Promise<string> {
  let compressedDataUrl = "";
  let uploadBlob: Blob = file;

  // 1. まずブラウザ側で軽量化・圧縮
  try {
    const compressed = await compressImageFile(file, 400, 0.75);
    uploadBlob = compressed.blob;
    compressedDataUrl = compressed.dataUrl;
  } catch (err) {
    console.warn("Client image compression fallback:", err);
  }

  // 2. Supabase Storage が利用可能であればアップロードを試みる
  if (supabase) {
    try {
      const isWebp = uploadBlob.type === "image/webp";
      const ext = isWebp ? "webp" : "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
      const filePath = `items/${fileName}`;

      const { data, error } = await supabase.storage
        .from("item-images")
        .upload(filePath, uploadBlob, {
          cacheControl: "3600",
          contentType: uploadBlob.type || "image/webp",
          upsert: true,
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from("item-images")
          .getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      } else {
        console.warn("Supabase Storage notice, falling back to compressed data URL:", error?.message);
      }
    } catch (err) {
      console.warn("Storage upload fallback:", err);
    }
  }

  // 3. 圧縮後の Data URL を返す（Storage 未作成時でもわずか 10〜25KB で安全に保存可能）
  if (compressedDataUrl) {
    return compressedDataUrl;
  }

  // 4. 最終フォールバック
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
