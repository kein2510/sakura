export type ThemeColorKey = "amber" | "rose" | "emerald" | "blue" | "purple" | "stone";

export interface ThemeStyles {
  key: ThemeColorKey;
  name: string;
  desc: string;
  // メインボタン（保存・ログイン・主要アクション）
  primaryBtn: string;
  // 強調テキスト（アクセント見出し・アクティブ文字）
  accentText: string;
  // 枠線アクセント（ロゴ枠・アクティブカード枠）
  accentBorder: string;
  // バッジ・ピル（所属・タグ）
  accentBadge: string;
  // サイドバーのアクティブメニュー背景
  sidebarActive: string;
  // 幹部画面のアクティブタブ
  tabActive: string;
  // ログイン画面の送信ボタン
  loginBtn: string;
  // フォーカスリング
  focusRing: string;
  // 背景アクセント
  accentBg: string;
  // グロー・シャドウ
  shadowGlow: string;
}

export const THEME_PALETTES: Record<ThemeColorKey, ThemeStyles> = {
  amber: {
    key: "amber",
    name: "琥珀ゴールド",
    desc: "和風・料亭・シック",
    primaryBtn: "bg-amber-600 hover:bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-950/50",
    accentText: "text-amber-400",
    accentBorder: "border-amber-400/50",
    accentBadge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    sidebarActive: "bg-amber-600 text-stone-950 border-amber-500 shadow-md shadow-amber-950/50 font-black",
    tabActive: "bg-amber-600 text-stone-950 shadow-md font-black scale-[1.02]",
    loginBtn: "bg-amber-600 hover:bg-amber-500 text-stone-950 font-black shadow-lg shadow-amber-950/40",
    focusRing: "focus:border-amber-500 focus:ring-amber-500",
    accentBg: "bg-amber-500/10",
    shadowGlow: "shadow-amber-950/40",
  },
  rose: {
    key: "rose",
    name: "桜・深紅",
    desc: "和モダン・華やか",
    primaryBtn: "bg-rose-600 hover:bg-rose-500 text-white font-black shadow-md shadow-rose-950/50",
    accentText: "text-rose-400",
    accentBorder: "border-rose-400/50",
    accentBadge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    sidebarActive: "bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50 font-black",
    tabActive: "bg-rose-600 text-white shadow-md font-black scale-[1.02]",
    loginBtn: "bg-rose-600 hover:bg-rose-500 text-white font-black shadow-lg shadow-rose-950/40",
    focusRing: "focus:border-rose-500 focus:ring-rose-500",
    accentBg: "bg-rose-500/10",
    shadowGlow: "shadow-rose-950/40",
  },
  emerald: {
    key: "emerald",
    name: "翡翠グリーン",
    desc: "茶屋・自然・オーガニック",
    primaryBtn: "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md shadow-emerald-950/50",
    accentText: "text-emerald-400",
    accentBorder: "border-emerald-400/50",
    accentBadge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    sidebarActive: "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50 font-black",
    tabActive: "bg-emerald-600 text-white shadow-md font-black scale-[1.02]",
    loginBtn: "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-950/40",
    focusRing: "focus:border-emerald-500 focus:ring-emerald-500",
    accentBg: "bg-emerald-500/10",
    shadowGlow: "shadow-emerald-950/40",
  },
  blue: {
    key: "blue",
    name: "藍ネイビー",
    desc: "バー・クール・海鮮",
    primaryBtn: "bg-blue-600 hover:bg-blue-500 text-white font-black shadow-md shadow-blue-950/50",
    accentText: "text-blue-400",
    accentBorder: "border-blue-400/50",
    accentBadge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    sidebarActive: "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950/50 font-black",
    tabActive: "bg-blue-600 text-white shadow-md font-black scale-[1.02]",
    loginBtn: "bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg shadow-blue-950/40",
    focusRing: "focus:border-blue-500 focus:ring-blue-500",
    accentBg: "bg-blue-500/10",
    shadowGlow: "shadow-blue-950/40",
  },
  purple: {
    key: "purple",
    name: "紫陽花パープル",
    desc: "高級・イタリアン・妖艶",
    primaryBtn: "bg-purple-600 hover:bg-purple-500 text-white font-black shadow-md shadow-purple-950/50",
    accentText: "text-purple-400",
    accentBorder: "border-purple-400/50",
    accentBadge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    sidebarActive: "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-950/50 font-black",
    tabActive: "bg-purple-600 text-white shadow-md font-black scale-[1.02]",
    loginBtn: "bg-purple-600 hover:bg-purple-500 text-white font-black shadow-lg shadow-purple-950/40",
    focusRing: "focus:border-purple-500 focus:ring-purple-500",
    accentBg: "bg-purple-500/10",
    shadowGlow: "shadow-purple-950/40",
  },
  stone: {
    key: "stone",
    name: "漆黒モノトーン",
    desc: "無骨・シンプル・モダン",
    primaryBtn: "bg-stone-200 hover:bg-white text-stone-950 font-black shadow-md shadow-stone-950/50",
    accentText: "text-stone-200",
    accentBorder: "border-stone-400/50",
    accentBadge: "bg-stone-800 text-stone-200 border-stone-600",
    sidebarActive: "bg-stone-200 text-stone-950 border-white shadow-md font-black",
    tabActive: "bg-stone-200 text-stone-950 shadow-md font-black scale-[1.02]",
    loginBtn: "bg-stone-200 hover:bg-white text-stone-950 font-black shadow-lg shadow-stone-950/40",
    focusRing: "focus:border-stone-400 focus:ring-stone-400",
    accentBg: "bg-stone-800/40",
    shadowGlow: "shadow-stone-950/40",
  },
};

export function getThemeStyles(themeColor?: string): ThemeStyles {
  const key = (themeColor as ThemeColorKey) || "amber";
  return THEME_PALETTES[key] || THEME_PALETTES.amber;
}
