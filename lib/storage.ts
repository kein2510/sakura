import { supabase } from "./supabase";

/**
 * 画像ファイルをSupabase Storageにアップロードする、
 * またはBase64 Data URLとして読み込んで返す関数
 */
export async function uploadImage(file: File): Promise<string> {
  // 1. Supabase Storage が利用可能であればアップロードを試みる
  if (supabase) {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { data, error } = await supabase.storage
        .from("item-images")
        .upload(filePath, file, {
          cacheControl: "3600",
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
        console.warn("Supabase Storage notice, falling back to local data URL:", error?.message);
      }
    } catch (err) {
      console.warn("Storage upload fallback:", err);
    }
  }

  // 2. フォールバック: FileReader で Base64 Data URL を生成（オフラインやバケット未作成時でも確実にプレビュー・保存可能）
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
