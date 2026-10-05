import { createClient } from "@supabase/supabase-js";

// 本番Supabaseプロジェクト接続設定 (環境変数または安全な公開接続先フォールバック)
const DEFAULT_SUPABASE_URL = "https://pvygsweevwetjbqfrdet.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eWdzd2VldndldGpicWZyZGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMDI4NzgsImV4cCI6MjEwNjc3ODg3OH0.Y9mwmRQUIeme9BkEXMEFALCcaSmFj-aNQZCOWMX9Ys0";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
