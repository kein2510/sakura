export type Role = "staff" | "executive";

export interface CustomRole {
  id: string;          // 一意なID (例: "role-owner", "role-manager", "role-chef", "role-staff", "role-parttime")
  name: string;        // 役職名 (例: "店主", "店長", "料理長", "一般スタッフ", "アルバイト")
  color: string;       // バッジカラー ("amber" | "rose" | "emerald" | "blue" | "purple" | "stone")
  isExecutive: boolean;// 幹部専用コンソールへのアクセス権限
  baseAllowance?: number; // ロールごとの週次基本手当 (¥)
  description?: string;// 役職の説明や業務内容
  isDefault?: boolean; // 新規追加時の初期ロール
}

export interface StaffUser {
  id: string;
  username: string; // ログイン用名前 (例: kein)
  pass: string;     // ログイン用PASS (例: 001)
  displayName: string;
  role: Role;       // 互換用基本権限 ("executive" | "staff")
  roleId?: string;  // 紐づくカスタムロールのID
  roleName?: string;// 役職の表示名 (例: "店主")
  order?: number;   // 従業員一覧の並び順 (昇順)
  bonusAmount?: number; // 幹部が設定するボーナス額 (¥)
  bonusNote?: string;   // 査定理由・評価メモ
  created_at: string;
}

export interface StoreSettings {
  enableCrafting: boolean;          // クラフト作成機能をする(true)/しない(false)
  enableInventory: boolean;         // 全体在庫管理をする(true)/しない(false)
  ingredientRewardRate?: number;    // 素材調達手当 (円/個)
  craftRewardRate?: number;         // クラフト仕込み手当 (円/個)
  storeRemainingBonusRate?: number; // 店舗7割歩合率 (%)
}

export type ItemType = "product" | "ingredient"; // product: 販売商品, ingredient: 作成用素材

export interface RecipeRequirement {
  ingredient_id: string;   // 素材アイテムのID
  ingredient_name: string; // 素材名
  quantity: number;        // 1個作るのに必要な個数
  unit?: string;           // 単位 (個, 本など)
}

export type ShopId = "sakura" | "buon_viaggio";

export interface ShopDefinition {
  id: ShopId;
  name: string;
  shortName: string;
  icon: string;
  themeColor: string;
}

export const SHOPS: ShopDefinition[] = [
  {
    id: "sakura",
    name: "和食さくら",
    shortName: "さくら",
    icon: "🌸",
    themeColor: "rose",
  },
  {
    id: "buon_viaggio",
    name: "Buon viaggio",
    shortName: "Buon viaggio",
    icon: "🍷",
    themeColor: "emerald",
  },
];

export interface Item {
  id: string;
  code?: string;
  name: string;
  type: ItemType;
  shopId?: ShopId;         // 料理商品の所属店舗 ("sakura" | "buon_viaggio")。素材は共通。
  unit: string;
  current_stock: number;
  selling_price: number;   // 販売価格 (素材の場合は0または仕入価格)
  cost_price?: number;
  category_id?: string;
  category_name?: string;
  optimal_stock?: number;
  alert_threshold?: number;
  image_url?: string;
  recipe?: RecipeRequirement[]; // 商品を作るのに必要な素材リスト (type === 'product' のみ)
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  // 互換用プロパティ
  item_id?: string;
  item_name?: string;
}

export type PaymentMethod = "credit" | "qr" | "cash" | "card" | "ic_card" | "electronic" | "fivem_cash";

export interface Sale {
  id: string;
  shopId?: ShopId;      // どの店舗での売上か ("sakura" | "buon_viaggio")
  staffName: string;
  staffUserId?: string; // 担当スタッフのID (スタッフ別売上集計用)
  totalAmount: number;
  items: SaleItem[];
  created_at: string;
  // 互換用プロパティ
  total_amount?: number;
  payment_method?: PaymentMethod;
  staff_name?: string;
  notes?: string;
}

export type TransactionType = "inbound" | "outbound" | "waste" | "craft" | "sale" | "adjust";

export interface StockTransaction {
  id: string;
  item_id: string;
  item_name: string;
  transaction_type: TransactionType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  user_name?: string;
  created_at: string;
}

export interface OrderRecord {
  id: string;
  item_id: string;
  item_name: string;
  supplier_name: string;
  quantity: number;
  expected_delivery: string;
  status: "ordered" | "delivered" | "cancelled";
  staff_name: string;
  created_at: string;
}

export type ActionCategory =
  | "sale"       // 売る
  | "craft"      // 在庫作成 (素材消費)
  | "inventory"  // 在庫調整
  | "recipe"     // レシピ設定
  | "product"    // 商品/素材追加・変更・削除
  | "user"       // 従業員/PASS設定
  | "role"       // 役職・ロール設定
  | "bonus"      // ボーナス・給与設定
  | "vault"      // ゲーム内金庫調整
  | "auth";      // ログイン/ログアウト

export interface ActionLog {
  id: string;
  userName: string;
  userRole: Role;
  category: ActionCategory;
  title: string;
  detail: string;
  created_at: string;
}

export interface StaffPerformance {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  roleId?: string;
  roleName?: string;
  totalSalesAmount: number;    // 累計売上金額
  salesCount: number;          // 売上伝票件数
  totalItemsSold: number;      // 販売した料理の合計個数
  craftCount: number;          // クラフト（料理作成）実行回数
  totalItemsCrafted: number;   // 作成した料理の合計個数
  inventoryAdjustCount: number;// 在庫調整・補充回数
  ingredientItemsCount?: number;// 調達・補充した素材アイテムの個数
  lastActiveTime?: string;     // 最終アクション時刻
  currentBonus: number;        // 現在設定されているボーナス額
  bonusNote?: string;          // 査定メモ
}

export interface ShopWeeklySummary {
  salesAmount: number;
  incentive30: number;
  storeRemaining70: number;
  craftItemsCount: number;
  itemsSold: number;
}

export interface StaffWeeklyStat {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  roleId?: string;
  roleName?: string;
  salesAmount: number;         // その週の総売上額 (100%)
  // 店舗別売上内訳
  sakuraSalesAmount: number;   // 和食さくら 売上額
  buonViaggioSalesAmount: number; // Buon viaggio 売上額
  sakuraItemsSold: number;     // 和食さくら 販売個数
  buonViaggioItemsSold: number;// Buon viaggio 販売個数
  salesCount: number;          // 販売伝票件数
  itemsSold: number;           // 販売した料理個数
  incentive30: number;         // 手渡しインセンティブ (3割 / 30%)
  storeRemaining70: number;    // 店舗純残額 (7割 / 70%)
  craftCount: number;          // クラフト実行回数
  craftItemsCount: number;     // 作成した料理の合計個数
  inventoryAdjustCount: number;// 食材調達・補充回数
  ingredientItemsCount: number;// 調達・補充した素材アイテムの個数
  bonusAmount: number;         // 店主が決めたこの週のボーナス額 (¥)
  bonusNote?: string;          // 査定評価メモ
  isPaid?: boolean;            // この週のボーナスが支払済みかどうか
  paidAt?: string;             // 支払い完了日時
  // 過去の未払い繰越情報
  previousUnpaidBonusTotal: number; // 過去の確定済みで未払いのボーナス累計 (¥)
  previousUnpaidWeeks: { weekKey: string; weekLabel: string; amount: number }[]; // 未払い週の内訳
  totalDueAmount: number;      // 今週の決定額 + 過去未払い繰越の総額 (¥)
  thisWeekUnpaidAmount: number;// 今週分の未払い額 (isPaidなら0、未払いならbonusAmount)
  remainingDueAmount: number;  // 現在スタッフに手渡すべき「残り金額」(¥) ★未払いを支払済にすると減る！
  weekSales: Sale[];           // その週の売上伝票リスト
}

export interface WeeklySummary {
  weekKey: string;             // 例: "2026-08-30_2026-09-05"
  weekLabel: string;           // 例: "2026/08/30(日) 〜 09/05(土)"
  startDate: string;           // ISO
  endDate: string;             // ISO
  isCurrentWeek: boolean;      // 今週進行中かどうか
  isFinalized: boolean;        // 店主がボーナス確定済みかどうか
  finalizedAt?: string;
  finalizedBy?: string;        // 例: "kein"
  // 各店舗別の売上・実績
  sakura: ShopWeeklySummary;      // 和食さくら
  buonViaggio: ShopWeeklySummary; // Buon viaggio
  // 店舗全体合計
  totalSales: number;          // 店舗総売上 (100%)
  totalIncentive30: number;    // スタッフ手渡しインセンティブ総額 (3割)
  totalStoreRemaining70: number;// 店舗純残額 (7割)
  totalCraftItems: number;     // 店舗総クラフト個数
  totalBonusPayout: number;    // 今週の決定ボーナス総額
  totalUnpaidCarryover: number;// 全スタッフの過去未払い繰越総額
  totalDuePayout: number;      // 今週決定分 + 過去未払い合算の総額
  totalRemainingDuePayout: number; // 全スタッフの未払い残り総額 (支払済にすると減る手渡し必要総額)
  staffStats: StaffWeeklyStat[];// スタッフ別実績
}

