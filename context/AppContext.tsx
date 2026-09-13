"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  StaffUser,
  Role,
  CustomRole,
  Item,
  RecipeRequirement,
  Sale,
  ActionLog,
  ActionCategory,
  StaffPerformance,
  WeeklySummary,
  StaffWeeklyStat,
  ShopId,
  SHOPS,
  StoreSettings,
} from "@/types";
import {
  mockStaffUsers,
  initialItems,
  initialActionLogs,
  initialSales,
} from "@/data/mockData";
import { getRecentWeeks, isDateInWeek, WeekPeriod } from "@/lib/dateUtils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const defaultCustomRoles: CustomRole[] = [
  {
    id: "role-owner",
    name: "店主 (オーナー)",
    color: "amber",
    isExecutive: true,
    baseAllowance: 50000,
    description: "店舗最高責任者・全権限（kein）",
    isDefault: false,
  },
  {
    id: "role-manager",
    name: "店長 / 幹部",
    color: "rose",
    isExecutive: true,
    baseAllowance: 40000,
    description: "店舗運営・管理業務・ボーナス査定",
    isDefault: false,
  },
  {
    id: "role-chef",
    name: "料理長",
    color: "emerald",
    isExecutive: false,
    baseAllowance: 30000,
    description: "厨房統括・仕込み・クラフト責任者",
    isDefault: false,
  },
  {
    id: "role-staff",
    name: "一般スタッフ",
    color: "blue",
    isExecutive: false,
    baseAllowance: 15000,
    description: "ホール接客・調理作成・レジ販売",
    isDefault: true,
  },
  {
    id: "role-parttime",
    name: "アルバイト / 見習い",
    color: "emerald",
    isExecutive: false,
    baseAllowance: 10000,
    description: "仕込み補助・接客サポート",
    isDefault: false,
  },
];

export type SyncStatus = "connected" | "syncing" | "offline";

interface AppContextType {
  // クラウド同期状態
  syncStatus: SyncStatus;

  // 認証関連
  currentUser: StaffUser | null;
  isAuthenticated: boolean;
  login: (username: string, pass: string) => { success: boolean; message?: string };
  logout: () => void;

  // 従業員管理 (幹部のみ)
  users: StaffUser[];
  addUser: (user: Omit<StaffUser, "id" | "created_at">) => void;
  updateUserPass: (userId: string, newPass: string) => void;
  updateUserRole: (userId: string, role: Role) => void;
  updateUserBonus: (userId: string, bonusAmount: number, note?: string) => void;
  updateUsersOrder: (orderedUsers: StaffUser[]) => void;
  deleteUser: (userId: string) => void;
  getStaffPerformances: () => StaffPerformance[];

  // 店舗・機能利用設定 (クラフト・在庫管理のする/しない)
  storeSettings: StoreSettings;
  updateStoreSettings: (updates: Partial<StoreSettings>) => void;

  // 役職・カスタムロール管理
  roles: CustomRole[];
  addRole: (role: Omit<CustomRole, "id">) => void;
  updateRole: (roleId: string, updates: Partial<CustomRole>) => void;
  deleteRole: (roleId: string) => { success: boolean; message: string };
  updateUserCustomRole: (userId: string, roleId: string) => void;

  // 週次ボーナス・インセンティブ管理 (日曜始まり土曜締め)
  getWeeklySummary: (weekKey?: string) => WeeklySummary;
  saveWeeklyBonus: (
    weekKey: string,
    staffBonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean; paidAt?: string; ingredientCount?: number } }
  ) => void;
  finalizeWeeklyBonus: (weekKey: string) => void;
  unfinalizeWeeklyBonus: (weekKey: string) => void;
  toggleBonusPaid: (weekKey: string, userId: string, isPaid: boolean) => void;
  markAllPastBonusesAsPaid: (userId: string) => void;

  // アイテム・在庫関連
  items: Item[];
  products: Item[];
  ingredients: Item[];

  // メイン業務アクション (店舗shopId指定対応)
  sellProducts: (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ) => {
    success: boolean;
    message: string;
  };
  craftProducts: (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ) => {
    success: boolean;
    message: string;
  };

  // 幹部用 設定機能
  addItem: (item: Omit<Item, "id" | "created_at" | "updated_at">) => void;
  updateItem: (itemId: string, updates: Partial<Item>) => void;
  deleteItem: (itemId: string) => { success: boolean; message: string };
  updatePrice: (itemId: string, newPrice: number) => void;
  updateRecipe: (itemId: string, recipe: RecipeRequirement[]) => void;
  updateItemImage: (itemId: string, imageUrl: string) => void;
  adjustStock: (itemId: string, newStock: number, reason?: string) => void;

  // 履歴・ログ
  sales: Sale[];
  actionLogs: ActionLog[];
  logAction: (params: { category: ActionCategory; title: string; detail: string }) => void;

  // ゲーム内金庫管理
  vaultBalance: number;
  updateVaultBalance: (newBalance: number, reason?: string) => void;

  // 誤操作取り消し・ロールバック機能
  cancelSale: (saleId: string) => { success: boolean; message: string };
  rollbackCraftItems: (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ) => { success: boolean; message: string };
  cancelCraftByLog: (logId: string) => { success: boolean; message: string };

  // クラウド強制再同期
  refreshData: () => Promise<void>;

  // 互換用メソッド
  addSale: (saleData: any) => Promise<Sale>;
  recordStockTransaction: (params: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // クラウド同期状態
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");

  // 役職・カスタムロール状態
  const [roles, setRoles] = useState<CustomRole[]>(() => {
    let current = defaultCustomRoles;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_roles");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            current = parsed;
          }
        } catch {
          // ignore
        }
      }
    }
    return current.map((r) => {
      if (typeof r.baseAllowance === "number") return r;
      if (r.id === "role-owner") return { ...r, baseAllowance: 50000 };
      if (r.id === "role-manager" || r.isExecutive) return { ...r, baseAllowance: 40000 };
      if (r.id === "role-chef" || r.name.includes("正社員")) return { ...r, baseAllowance: 30000 };
      if (r.id === "role-staff" || r.name.includes("アルバイト")) return { ...r, baseAllowance: 15000 };
      return { ...r, baseAllowance: 10000 };
    });
  });

  // ユーザー・認証状態 (初期は管理者 kein / PASS 001)
  const [users, setUsers] = useState<StaffUser[]>(() => {
    let loadedUsers: StaffUser[] = mockStaffUsers;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_users");
      if (saved) {
        try {
          loadedUsers = JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return loadedUsers.map((u) => {
      const isKein = u.username.toLowerCase() === "kein";
      if (isKein) {
        return {
          ...u,
          role: "executive" as Role,
          roleId: u.roleId || "role-owner",
          roleName: u.roleName || "店主 (オーナー)",
        };
      }
      return {
        ...u,
        roleId: u.roleId || (u.role === "executive" ? "role-manager" : "role-staff"),
        roleName: u.roleName || (u.role === "executive" ? "店長 / 幹部" : "一般スタッフ"),
      };
    });
  });

  // サイトを開いたときは常に未ログイン状態（同一タブ内での作業中リロードのみセッション復元）
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("fivem_sakura_session");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  // アイテム・在庫状態
  const [items, setItems] = useState<Item[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_items");
      if (saved) {
        try {
          const parsed: Item[] = JSON.parse(saved);
          const existingIds = new Set(parsed.map((i) => i.id));
          const newDefaults = initialItems.filter((i) => !existingIds.has(i.id));
          const normalized = parsed.map((item) => {
            if (item.type === "product" && !item.shopId) {
              return { ...item, shopId: "sakura" as ShopId };
            }
            return item;
          });
          return [...normalized, ...newDefaults];
        } catch {
          // ignore
        }
      }
    }
    return initialItems;
  });

  // 売上・操作ログ
  const [sales, setSales] = useState<Sale[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_sales");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return initialSales;
  });

  const [actionLogs, setActionLogs] = useState<ActionLog[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_action_logs");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return initialActionLogs;
  });

  // 週次ボーナス確定データ
  const [weeklyBonuses, setWeeklyBonuses] = useState<{
    [weekKey: string]: {
      isFinalized: boolean;
      finalizedAt?: string;
      finalizedBy?: string;
      bonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean; paidAt?: string; ingredientCount?: number } };
    };
  }>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_weekly_bonuses");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    const recentWeeks = getRecentWeeks(2);
    const lastWeek = recentWeeks[1];
    if (lastWeek) {
      return {
        [lastWeek.weekKey]: {
          isFinalized: false,
          bonuses: {
            "user-kein": { amount: 50000, note: "店舗立ち上げ・全体統括" },
            "user-suzuki": { amount: 40000, note: "料理仕込み・厨房クラフト担当" },
            "user-yamada": { amount: 25000, note: "売上トップ・接客良好" },
            "user-sato": { amount: 20000, note: "食材仕入れ・買い出し担当" },
          },
        },
      };
    }
    return {};
  });

  // ゲーム内金庫残高
  const [vaultBalance, setVaultBalance] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_vault_balance");
      if (saved !== null) {
        const num = parseInt(saved, 10);
        if (!isNaN(num)) return num;
      }
    }
    return 3000000;
  });

  // 店舗機能利用設定 (クラフト・在庫管理のする/しない、各種レート)
  const defaultStoreSettings: StoreSettings = {
    enableCrafting: true,
    enableInventory: true,
    ingredientRewardRate: 50,
    craftRewardRate: 50,
    storeRemainingBonusRate: 10,
  };

  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_store_settings");
      if (saved) {
        try {
          return { ...defaultStoreSettings, ...JSON.parse(saved) };
        } catch {
          // ignore
        }
      }
    }
    return defaultStoreSettings;
  });

  // ローカル永続化 (オフラインバックアップ用)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_store_settings", JSON.stringify(storeSettings));
    }
  }, [storeSettings]);

  // ローカル永続化 (オフラインバックアップ用)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_vault_balance", vaultBalance.toString());
    }
  }, [vaultBalance]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_roles", JSON.stringify(roles));
    }
  }, [roles]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_users", JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_weekly_bonuses", JSON.stringify(weeklyBonuses));
    }
  }, [weeklyBonuses]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_sales", JSON.stringify(sales));
    }
  }, [sales]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_action_logs", JSON.stringify(actionLogs));
    }
  }, [actionLogs]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fivem_sakura_items", JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (currentUser) {
        sessionStorage.setItem("fivem_sakura_session", JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem("fivem_sakura_session");
      }
    }
  }, [currentUser]);

  // ============================================================================
  // Supabase ヘルパー関数群（クラウド保存）
  // ============================================================================
  const syncItemToCloud = async (item: Item) => {
    if (!supabase) return;
    try {
      await supabase.from("sakura_items").upsert({
        id: item.id,
        code: item.code || null,
        name: item.name,
        type: item.type,
        shop_id: item.shopId || "sakura",
        unit: item.unit,
        current_stock: item.current_stock,
        optimal_stock: item.optimal_stock ?? 10,
        alert_threshold: item.alert_threshold ?? 3,
        cost_price: item.cost_price ?? 0,
        selling_price: item.selling_price,
        category_id: item.category_id || null,
        category_name: item.category_name || null,
        image_url: item.image_url || null,
        recipe: item.recipe || [],
        updated_at: item.updated_at || new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to sync item to cloud:", e);
    }
  };

  const syncItemsBatchToCloud = async (batchItems: Item[]) => {
    if (!supabase || batchItems.length === 0) return;
    try {
      const records = batchItems.map((item) => ({
        id: item.id,
        code: item.code || null,
        name: item.name,
        type: item.type,
        shop_id: item.shopId || "sakura",
        unit: item.unit,
        current_stock: item.current_stock,
        optimal_stock: item.optimal_stock ?? 10,
        alert_threshold: item.alert_threshold ?? 3,
        cost_price: item.cost_price ?? 0,
        selling_price: item.selling_price,
        category_id: item.category_id || null,
        category_name: item.category_name || null,
        image_url: item.image_url || null,
        recipe: item.recipe || [],
        updated_at: item.updated_at || new Date().toISOString(),
      }));
      await supabase.from("sakura_items").upsert(records);
    } catch (e) {
      console.error("Failed to batch sync items to cloud:", e);
    }
  };

  const deleteItemFromCloud = async (itemId: string) => {
    if (!supabase) return;
    try {
      await supabase.from("sakura_items").delete().eq("id", itemId);
    } catch (e) {
      console.error("Failed to delete item from cloud:", e);
    }
  };

  const syncSaleToCloud = async (sale: Sale) => {
    if (!supabase) return;
    try {
      await supabase.from("sakura_sales").insert({
        id: sale.id,
        shop_id: sale.shopId || "sakura",
        staff_name: sale.staffName || sale.staff_name || "店員",
        staff_user_id: sale.staffUserId || null,
        total_amount: sale.totalAmount ?? sale.total_amount ?? 0,
        items: sale.items || [],
        payment_method: sale.payment_method || "cash",
        notes: sale.notes || null,
        created_at: sale.created_at || new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to sync sale to cloud:", e);
    }
  };

  const syncLogToCloud = async (log: ActionLog) => {
    if (!supabase) return;
    try {
      await supabase.from("sakura_action_logs").insert({
        id: log.id,
        user_name: log.userName,
        user_role: log.userRole,
        category: log.category,
        title: log.title,
        detail: log.detail,
        created_at: log.created_at,
      });
    } catch (e) {
      console.error("Failed to sync log to cloud:", e);
    }
  };

  const syncStateToCloud = async (key: string, value: any) => {
    if (!supabase) return;
    try {
      await supabase.from("sakura_system_state").upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`Failed to sync state [${key}] to cloud:`, e);
    }
  };

  // 操作ログの追加（ローカル＋クラウド保存）
  const logAction = useCallback(
    ({
      category,
      title,
      detail,
    }: {
      category: ActionCategory;
      title: string;
      detail: string;
    }) => {
      const newLog: ActionLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userName: currentUser ? currentUser.displayName : "ゲスト",
        userRole: currentUser ? currentUser.role : "staff",
        category,
        title,
        detail,
        created_at: new Date().toISOString(),
      };
      setActionLogs((prev) => [newLog, ...prev]);
      syncLogToCloud(newLog);
    },
    [currentUser]
  );

  // ============================================================================
  // Supabase 初期データ取得 & Realtime 購読
  // ============================================================================
  const fetchCloudData = useCallback(async () => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    try {
      setSyncStatus("syncing");

      // (A) アイテム取得
      const { data: cloudItems, error: itemsErr } = await client
        .from("sakura_items")
        .select("*");

      if (!itemsErr && cloudItems) {
        if (cloudItems.length > 0) {
          const mapped: Item[] = cloudItems.map((c: any) => ({
            id: c.id,
            code: c.code || undefined,
            name: c.name,
            type: c.type,
            shopId: (c.shop_id as ShopId) || "sakura",
            unit: c.unit,
            current_stock: Number(c.current_stock),
            optimal_stock: Number(c.optimal_stock ?? 10),
            alert_threshold: Number(c.alert_threshold ?? 3),
            cost_price: Number(c.cost_price ?? 0),
            selling_price: Number(c.selling_price),
            category_id: c.category_id || undefined,
            category_name: c.category_name || undefined,
            image_url: c.image_url || undefined,
            recipe: c.recipe || [],
            created_at: c.created_at,
            updated_at: c.updated_at,
          }));
          setItems(mapped);
        } else {
          await syncItemsBatchToCloud(initialItems);
        }
      }

      // (B) 売上伝票取得
      const { data: cloudSales, error: salesErr } = await client
        .from("sakura_sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (!salesErr && cloudSales) {
        if (cloudSales.length > 0) {
          const mappedSales: Sale[] = cloudSales.map((s: any) => ({
            id: s.id,
            shopId: (s.shop_id as ShopId) || "sakura",
            staffName: s.staff_name,
            staffUserId: s.staff_user_id || undefined,
            totalAmount: Number(s.total_amount),
            total_amount: Number(s.total_amount),
            staff_name: s.staff_name,
            payment_method: s.payment_method,
            notes: s.notes || undefined,
            items: s.items || [],
            created_at: s.created_at,
          }));
          setSales(mappedSales);
        } else if (initialSales.length > 0) {
          for (const s of initialSales) {
            await syncSaleToCloud(s);
          }
        }
      }

      // (C) 操作ログ取得 (最新500件)
      const { data: cloudLogs, error: logsErr } = await client
        .from("sakura_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!logsErr && cloudLogs) {
        if (cloudLogs.length > 0) {
          const mappedLogs: ActionLog[] = cloudLogs.map((l: any) => ({
            id: l.id,
            userName: l.user_name,
            userRole: l.user_role as Role,
            category: l.category as ActionCategory,
            title: l.title,
            detail: l.detail,
            created_at: l.created_at,
          }));
          setActionLogs(mappedLogs);
        } else if (initialActionLogs.length > 0) {
          for (const l of initialActionLogs) {
            await syncLogToCloud(l);
          }
        }
      }

      // (D) 共通システム状態 (金庫残高, ボーナス, 役職, 従業員)
      const { data: stateData, error: stateErr } = await client
        .from("sakura_system_state")
        .select("*");

      if (!stateErr && stateData) {
        stateData.forEach((row: any) => {
          if (row.key === "vault_balance" && typeof row.value?.balance === "number") {
            setVaultBalance(row.value.balance);
          } else if (row.key === "weekly_bonuses" && row.value) {
            setWeeklyBonuses(row.value);
          } else if (row.key === "roles" && Array.isArray(row.value)) {
            const mappedRoles: CustomRole[] = row.value.map((r: any) => {
              if (typeof r.baseAllowance === "number") return r;
              if (r.id === "role-owner") return { ...r, baseAllowance: 50000 };
              if (r.id === "role-manager" || r.isExecutive) return { ...r, baseAllowance: 40000 };
              if (r.id === "role-chef" || (r.name && r.name.includes("正社員"))) return { ...r, baseAllowance: 30000 };
              if (r.id === "role-staff" || (r.name && r.name.includes("アルバイト"))) return { ...r, baseAllowance: 15000 };
              return { ...r, baseAllowance: 10000 };
            });
            setRoles(mappedRoles);
          } else if (row.key === "users" && Array.isArray(row.value)) {
            setUsers(row.value);
          } else if (row.key === "store_settings" && row.value) {
            setStoreSettings((prev) => ({ ...prev, ...row.value }));
          }
        });
      }

      setSyncStatus("connected");
    } catch (err) {
      console.error("Supabase initial load error:", err);
      setSyncStatus("offline");
    }
  }, []);

  const refreshData = async () => {
    await fetchCloudData();
  };

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setSyncStatus("offline");
      return;
    }

    let isMounted = true;
    fetchCloudData();

    // 2. Realtime 購読
    const channel = client
      .channel("sakura_realtime_all")
      // アイテム変更
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_items" },
        (payload) => {
          if (!isMounted) return;
          const ev = payload.eventType;
          if (ev === "INSERT" || ev === "UPDATE") {
            const c = payload.new as any;
            const updatedItem: Item = {
              id: c.id,
              code: c.code || undefined,
              name: c.name,
              type: c.type,
              shopId: (c.shop_id as ShopId) || "sakura",
              unit: c.unit,
              current_stock: Number(c.current_stock),
              optimal_stock: Number(c.optimal_stock ?? 10),
              alert_threshold: Number(c.alert_threshold ?? 3),
              cost_price: Number(c.cost_price ?? 0),
              selling_price: Number(c.selling_price),
              category_id: c.category_id || undefined,
              category_name: c.category_name || undefined,
              image_url: c.image_url || undefined,
              recipe: c.recipe || [],
              created_at: c.created_at,
              updated_at: c.updated_at,
            };
            setItems((prev) => {
              const idx = prev.findIndex((i) => i.id === updatedItem.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedItem;
                return next;
              }
              return [updatedItem, ...prev];
            });
          } else if (ev === "DELETE") {
            const oldId = (payload.old as any).id;
            if (oldId) {
              setItems((prev) => prev.filter((i) => i.id !== oldId));
            }
          }
        }
      )
      // 売上伝票変更
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_sales" },
        (payload) => {
          if (!isMounted) return;
          const ev = payload.eventType;
          if (ev === "INSERT" || ev === "UPDATE") {
            const s = payload.new as any;
            const newSale: Sale = {
              id: s.id,
              shopId: (s.shop_id as ShopId) || "sakura",
              staffName: s.staff_name,
              staffUserId: s.staff_user_id || undefined,
              totalAmount: Number(s.total_amount),
              total_amount: Number(s.total_amount),
              staff_name: s.staff_name,
              payment_method: s.payment_method,
              notes: s.notes || undefined,
              items: s.items || [],
              created_at: s.created_at,
            };
            setSales((prev) => {
              const idx = prev.findIndex((item) => item.id === newSale.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = newSale;
                return next;
              }
              return [newSale, ...prev];
            });
          } else if (ev === "DELETE") {
            const oldId = (payload.old as any).id;
            if (oldId) {
              setSales((prev) => prev.filter((item) => item.id !== oldId));
            }
          }
        }
      )
      // 操作ログ変更
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_action_logs" },
        (payload) => {
          if (!isMounted) return;
          const ev = payload.eventType;
          if (ev === "INSERT" || ev === "UPDATE") {
            const l = payload.new as any;
            const newLog: ActionLog = {
              id: l.id,
              userName: l.user_name,
              userRole: l.user_role as Role,
              category: l.category as ActionCategory,
              title: l.title,
              detail: l.detail,
              created_at: l.created_at,
            };
            setActionLogs((prev) => {
              const idx = prev.findIndex((item) => item.id === newLog.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = newLog;
                return next;
              }
              return [newLog, ...prev];
            });
          } else if (ev === "DELETE") {
            const oldId = (payload.old as any).id;
            if (oldId) {
              setActionLogs((prev) => prev.filter((item) => item.id !== oldId));
            }
          }
        }
      )
      // システム共通状態 (金庫、ボーナス、ロール、ユーザー)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_system_state" },
        (payload) => {
          if (!isMounted) return;
          const row = payload.new as any;
          if (!row || !row.key) return;
          if (row.key === "vault_balance" && typeof row.value?.balance === "number") {
            setVaultBalance(row.value.balance);
          } else if (row.key === "weekly_bonuses" && row.value) {
            setWeeklyBonuses(row.value);
          } else if (row.key === "roles" && Array.isArray(row.value)) {
            const mappedRoles: CustomRole[] = row.value.map((r: any) => {
              if (typeof r.baseAllowance === "number") return r;
              if (r.id === "role-owner") return { ...r, baseAllowance: 50000 };
              if (r.id === "role-manager" || r.isExecutive) return { ...r, baseAllowance: 40000 };
              if (r.id === "role-chef" || (r.name && r.name.includes("正社員"))) return { ...r, baseAllowance: 30000 };
              if (r.id === "role-staff" || (r.name && r.name.includes("アルバイト"))) return { ...r, baseAllowance: 15000 };
              return { ...r, baseAllowance: 10000 };
            });
            setRoles(mappedRoles);
          } else if (row.key === "users" && Array.isArray(row.value)) {
            setUsers(row.value);
          } else if (row.key === "store_settings" && row.value) {
            setStoreSettings((prev) => ({ ...prev, ...row.value }));
          }
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === "SUBSCRIBED") {
          setSyncStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setSyncStatus("offline");
        }
      });

    // 画面フォーカス時またはタブ復帰時の自動再同期
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchCloudData();
      }
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("visibilitychange", handleFocus);

    // 15秒ごとの定期バックアップ同期
    const intervalTimer = setInterval(fetchCloudData, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("visibilitychange", handleFocus);
      clearInterval(intervalTimer);
      client.removeChannel(channel);
    };
  }, []);

  // 1. ログイン処理 (名前とPASS)
  const login = (username: string, pass: string): { success: boolean; message?: string } => {
    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = pass.trim();

    const found = users.find(
      (u) => u.username.toLowerCase() === trimmedUser && u.pass === trimmedPass
    );

    if (found) {
      setCurrentUser(found);
      const newLog: ActionLog = {
        id: `log-${Date.now()}`,
        userName: found.displayName,
        userRole: found.role,
        category: "auth",
        title: "ログイン成功",
        detail: `「${found.displayName} (${found.role === "executive" ? "幹部" : "スタッフ"})」がログインしました`,
        created_at: new Date().toISOString(),
      };
      setActionLogs((prev) => [newLog, ...prev]);
      syncLogToCloud(newLog);
      return { success: true };
    }

    return { success: false, message: "名前またはPASSが正しくありません。" };
  };

  // ログアウト
  const logout = () => {
    if (currentUser) {
      logAction({
        category: "auth",
        title: "ログアウト",
        detail: `「${currentUser.displayName}」がログアウトしました`,
      });
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("fivem_sakura_session");
      localStorage.removeItem("fivem_sakura_session");
    }
    setCurrentUser(null);
  };

  // 2. 従業員管理機能 (幹部専用)
  const addUser = ({
    username,
    pass,
    displayName,
    role,
    roleId,
    roleName,
  }: Omit<StaffUser, "id" | "created_at">) => {
    const targetRole = roleId ? roles.find((r) => r.id === roleId) : roles.find((r) => r.isDefault) || roles[0];
    const finalRoleId = targetRole ? targetRole.id : roleId;
    const finalRoleName = targetRole ? targetRole.name : roleName;
    const finalRole = targetRole ? (targetRole.isExecutive ? "executive" : "staff") : role;

    const newUser: StaffUser = {
      id: `user-${Date.now()}`,
      username: username.trim(),
      pass: pass.trim(),
      displayName: displayName.trim() || username.trim(),
      role: finalRole,
      roleId: finalRoleId,
      roleName: finalRoleName,
      created_at: new Date().toISOString(),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    logAction({
      category: "user",
      title: "従業員の追加",
      detail: `新しい従業員「${newUser.displayName} (PASS: ${newUser.pass} / 役職: ${newUser.roleName || "一般スタッフ"})」を登録しました`,
    });
  };

  const updateUserPass = (userId: string, newPass: string) => {
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return { ...u, pass: newPass.trim() };
      }
      return u;
    });
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    const u = users.find((item) => item.id === userId);
    logAction({
      category: "user",
      title: "PASSの変更",
      detail: `「${u?.displayName || userId}」のログインPASSを変更しました`,
    });
  };

  const updateUserRole = (userId: string, role: Role) => {
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return { ...u, role };
      }
      return u;
    });
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    const u = users.find((item) => item.id === userId);
    logAction({
      category: "user",
      title: "権限の変更",
      detail: `「${u?.displayName || userId}」の権限を「${role === "executive" ? "幹部" : "スタッフ"}」に変更しました`,
    });
  };

  // 従業員一覧の並び順の更新・一括保存
  const updateUsersOrder = (orderedUsers: StaffUser[]) => {
    const updated = orderedUsers.map((u, idx) => ({
      ...u,
      order: idx,
    }));
    setUsers(updated);
    syncStateToCloud("users", updated);
  };

  // 店舗・機能利用設定の更新 (クラフト作成・在庫管理のする/しない)
  const updateStoreSettings = (updates: Partial<StoreSettings>) => {
    setStoreSettings((prev) => {
      const next = { ...prev, ...updates };
      syncStateToCloud("store_settings", next);
      return next;
    });
    logAction({
      category: "role",
      title: "店舗機能設定の更新",
      detail: `機能設定を更新しました (クラフト作成: ${updates.enableCrafting !== undefined ? (updates.enableCrafting ? "有効" : "停止") : "維持"}, 在庫管理: ${updates.enableInventory !== undefined ? (updates.enableInventory ? "有効" : "停止") : "維持"})`,
    });
  };

  // 役職・カスタムロールの管理
  const addRole = (roleData: Omit<CustomRole, "id">) => {
    const newRole: CustomRole = {
      ...roleData,
      id: `role-${Date.now().toString().slice(-5)}`,
    };
    const updatedRoles = [...roles, newRole];
    setRoles(updatedRoles);
    syncStateToCloud("roles", updatedRoles);

    logAction({
      category: "role",
      title: `役職「${newRole.name}」の新規作成`,
      detail: `権限: ${newRole.isExecutive ? "幹部権限あり" : "一般スタッフ"} / 表示色: ${newRole.color} / 説明: ${newRole.description || "なし"}`,
    });
  };

  const updateRole = (roleId: string, updates: Partial<CustomRole>) => {
    const target = roles.find((r) => r.id === roleId);
    const updatedRoles = roles.map((r) => (r.id === roleId ? { ...r, ...updates } : r));
    setRoles(updatedRoles);
    syncStateToCloud("roles", updatedRoles);

    // 該当ロールを持つ全スタッフの role / roleName を同期更新
    const updatedUsers = users.map((u) => {
      if (u.roleId === roleId) {
        const updatedRoleName = updates.name !== undefined ? updates.name : u.roleName;
        const updatedExec =
          updates.isExecutive !== undefined
            ? (updates.isExecutive ? "executive" : "staff")
            : u.role;
        return {
          ...u,
          role: updatedExec,
          roleName: updatedRoleName,
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    if (target) {
      logAction({
        category: "role",
        title: `役職「${target.name}」の更新`,
        detail: `役職内容を変更しました (${Object.keys(updates).join(", ")})`,
      });
    }
  };

  const deleteRole = (roleId: string): { success: boolean; message: string } => {
    const target = roles.find((r) => r.id === roleId);
    if (!target) return { success: false, message: "対象の役職が見つかりません。" };
    if (roleId === "role-owner") {
      return { success: false, message: "「店主 (オーナー)」役職は削除できません。" };
    }
    const usingUsers = users.filter((u) => u.roleId === roleId);
    if (usingUsers.length > 0) {
      const userNames = usingUsers.map((u) => u.displayName).join("、");
      return {
        success: false,
        message: `この役職は現在【${userNames}】に割り当てられているため削除できません。先に別の役職へ変更してください。`,
      };
    }
    const updatedRoles = roles.filter((r) => r.id !== roleId);
    setRoles(updatedRoles);
    syncStateToCloud("roles", updatedRoles);

    logAction({
      category: "role",
      title: `役職の削除`,
      detail: `役職「${target.name}」を削除しました`,
    });
    return { success: true, message: `役職「${target.name}」を削除しました。` };
  };

  const updateUserCustomRole = (userId: string, roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const targetUser = users.find((u) => u.id === userId);

    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        const updated: StaffUser = {
          ...u,
          roleId: role.id,
          roleName: role.name,
          role: (role.isExecutive ? "executive" : "staff") as Role,
        };
        if (currentUser && currentUser.id === userId) {
          setCurrentUser(updated);
        }
        return updated;
      }
      return u;
    });
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    logAction({
      category: "user",
      title: `従業員役職の変更`,
      detail: `「${targetUser?.displayName || userId}」の役職を「${role.name}」(${role.isExecutive ? "幹部権限" : "一般スタッフ"})に変更しました`,
    });
  };

  const updateUserBonus = (userId: string, bonusAmount: number, note?: string) => {
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          bonusAmount: Math.max(0, bonusAmount),
          bonusNote: note !== undefined ? note : u.bonusNote,
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    const u = users.find((item) => item.id === userId);
    logAction({
      category: "bonus",
      title: `ボーナス査定の変更 (${u?.displayName || userId})`,
      detail: `支給額を ¥${bonusAmount.toLocaleString()} に設定しました ${note ? `[評価メモ: ${note}]` : ""}`,
    });
  };

  const getStaffPerformances = (): StaffPerformance[] => {
    return users.map((u) => {
      const userSales = sales.filter(
        (s) => s.staffUserId === u.id || s.staffName === u.displayName || s.staff_name === u.displayName
      );
      const totalSalesAmount = userSales.reduce(
        (sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0),
        0
      );
      const salesCount = userSales.length;
      const totalItemsSold = userSales.reduce(
        (sum, s) => sum + s.items.reduce((iSum, it) => iSum + it.quantity, 0),
        0
      );

      const userCraftLogs = actionLogs.filter(
        (l) => l.userName === u.displayName && l.category === "craft"
      );
      const craftCount = userCraftLogs.length;
      let totalItemsCrafted = 0;
      userCraftLogs.forEach((l) => {
        const matches = Array.from(l.title.matchAll(/×(\d+)/g));
        if (matches.length > 0) {
          for (const m of matches) {
            totalItemsCrafted += parseInt(m[1]) || 1;
          }
        } else {
          totalItemsCrafted += 1;
        }
      });

      const inventoryAdjustCount = actionLogs.filter(
        (l) => l.userName === u.displayName && l.category === "inventory"
      ).length;

      const userLogs = actionLogs.filter((l) => l.userName === u.displayName);
      const lastActiveTime = userLogs[0]?.created_at || u.created_at;

      return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        roleId: u.roleId,
        roleName: u.roleName,
        totalSalesAmount,
        salesCount,
        totalItemsSold,
        craftCount,
        totalItemsCrafted,
        inventoryAdjustCount,
        lastActiveTime,
        currentBonus: u.bonusAmount || 0,
        bonusNote: u.bonusNote || "",
      };
    });
  };

  // 週次サマリー取得
  const getWeeklySummary = (targetWeekKey?: string): WeeklySummary => {
    const recentWeeks = getRecentWeeks(8);
    const activeWeek = targetWeekKey
      ? recentWeeks.find((w) => w.weekKey === targetWeekKey) || recentWeeks[0]
      : recentWeeks[1] || recentWeeks[0];

    const { weekKey, weekLabel, startDate, endDate, isCurrentWeek } = activeWeek;

    const weekSales = sales.filter((s) => isDateInWeek(s.created_at, startDate, endDate));
    const weekLogs = actionLogs.filter((l) => isDateInWeek(l.created_at, startDate, endDate));

    const savedRecord = weeklyBonuses[weekKey];
    const isFinalized = Boolean(savedRecord?.isFinalized);
    const finalizedAt = savedRecord?.finalizedAt;
    const finalizedBy = savedRecord?.finalizedBy;

    const staffStats: StaffWeeklyStat[] = users.map((u) => {
      const userSales = weekSales.filter(
        (s) => s.staffUserId === u.id || s.staffName === u.displayName || s.staff_name === u.displayName
      );
      const salesAmount = userSales.reduce(
        (sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0),
        0
      );
      const sakuraSales = userSales.filter((s) => (s.shopId || "sakura") === "sakura");
      const bvSales = userSales.filter((s) => s.shopId === "buon_viaggio");

      const sakuraSalesAmount = sakuraSales.reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);
      const buonViaggioSalesAmount = bvSales.reduce((sum, s) => sum + (s.totalAmount ?? s.total_amount ?? 0), 0);

      let sakuraItemsSold = 0;
      sakuraSales.forEach((s) => {
        s.items?.forEach((it) => { sakuraItemsSold += it.quantity || 0; });
      });
      let buonViaggioItemsSold = 0;
      bvSales.forEach((s) => {
        s.items?.forEach((it) => { buonViaggioItemsSold += it.quantity || 0; });
      });

      const salesCount = userSales.length;
      const itemsSold = sakuraItemsSold + buonViaggioItemsSold;

      const incentive30 = Math.floor(salesAmount * 0.3);
      const storeRemaining70 = salesAmount - incentive30;

      const userCraftLogs = weekLogs.filter(
        (l) => l.userName === u.displayName && l.category === "craft"
      );
      const craftCount = userCraftLogs.length;
      let craftItemsCount = 0;
      userCraftLogs.forEach((l) => {
        const matches = Array.from(l.title.matchAll(/×(\d+)/g));
        if (matches.length > 0) {
          for (const m of matches) {
            craftItemsCount += parseInt(m[1]) || 1;
          }
        } else {
          craftItemsCount += 1;
        }
      });

      const userInventoryLogs = weekLogs.filter(
        (l) => l.userName === u.displayName && l.category === "inventory"
      );
      const inventoryAdjustCount = userInventoryLogs.length;

      // 素材調達・補充個数の集計 (ログからの自動検出 + 手動上書き値の反映)
      let logIngredientCount = 0;
      userInventoryLogs.forEach((l) => {
        const itemMatch = l.title.match(/\((.+?)\)/);
        const itemName = itemMatch ? itemMatch[1] : "";
        const targetItem = items.find((it) => it.name === itemName);
        const isIngredient = targetItem ? targetItem.type === "ingredient" : (l.detail.includes("素材") || l.detail.includes("仕入") || l.title.includes("素材"));

        if (isIngredient) {
          const qtyMatch = l.detail.match(/在庫数\s*(\d+)\s*→\s*(\d+)/);
          if (qtyMatch) {
            const before = parseInt(qtyMatch[1], 10) || 0;
            const after = parseInt(qtyMatch[2], 10) || 0;
            if (after > before) {
              logIngredientCount += (after - before);
            } else {
              logIngredientCount += 1;
            }
          } else {
            logIngredientCount += 1;
          }
        }
      });

      const savedUserBonus = savedRecord?.bonuses?.[u.id];
      const savedIngredientCount = savedUserBonus?.ingredientCount;
      const ingredientItemsCount = typeof savedIngredientCount === "number" ? savedIngredientCount : logIngredientCount;

      const bonusAmount = savedUserBonus ? savedUserBonus.amount : (u.bonusAmount || 0);
      const bonusNote = savedUserBonus ? savedUserBonus.note : (u.bonusNote || "");
      const isPaid = savedUserBonus ? Boolean(savedUserBonus.isPaid) : false;
      const paidAt = savedUserBonus?.paidAt;

      let previousUnpaidBonusTotal = 0;
      const previousUnpaidWeeks: { weekKey: string; weekLabel: string; amount: number }[] = [];

      Object.entries(weeklyBonuses).forEach(([pastKey, pastRecord]) => {
        if (pastKey === weekKey) return;
        if (pastRecord.isFinalized) {
          const pastStaffBonus = pastRecord.bonuses?.[u.id];
          if (pastStaffBonus && pastStaffBonus.amount > 0 && !pastStaffBonus.isPaid) {
            previousUnpaidBonusTotal += pastStaffBonus.amount;
            const wInfo = getRecentWeeks(20).find((w) => w.weekKey === pastKey);
            previousUnpaidWeeks.push({
              weekKey: pastKey,
              weekLabel: wInfo?.weekLabel || pastKey,
              amount: pastStaffBonus.amount,
            });
          }
        }
      });

      // 今週分の未払い額（isPaidがtrueなら今週分は支払い済みなので0円、未払いならbonusAmount）
      const thisWeekUnpaidAmount = isPaid ? 0 : bonusAmount;

      // 今週決定分 + 過去確定未払いの総額 (決定時の総枠)
      const totalDueAmount = bonusAmount + previousUnpaidBonusTotal;

      // 現在スタッフへ手渡すべき「残り金額」(¥) ★未払いを支払済みにするとリアルタイムに減る！
      const remainingDueAmount = thisWeekUnpaidAmount + previousUnpaidBonusTotal;

      return {
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        roleId: u.roleId,
        roleName: u.roleName,
        salesAmount,
        sakuraSalesAmount,
        buonViaggioSalesAmount,
        sakuraItemsSold,
        buonViaggioItemsSold,
        salesCount,
        itemsSold,
        incentive30,
        storeRemaining70,
        craftCount,
        craftItemsCount,
        inventoryAdjustCount,
        ingredientItemsCount,
        bonusAmount,
        bonusNote,
        isPaid,
        paidAt,
        previousUnpaidBonusTotal,
        previousUnpaidWeeks,
        totalDueAmount,
        thisWeekUnpaidAmount,
        remainingDueAmount,
        weekSales: userSales,
      };
    });

    const sakuraSalesTotal = staffStats.reduce((sum, s) => sum + s.sakuraSalesAmount, 0);
    const sakuraIncentive30 = Math.floor(sakuraSalesTotal * 0.3);
    const sakuraStoreRemaining70 = sakuraSalesTotal - sakuraIncentive30;

    const bvSalesTotal = staffStats.reduce((sum, s) => sum + s.buonViaggioSalesAmount, 0);
    const bvIncentive30 = Math.floor(bvSalesTotal * 0.3);
    const bvStoreRemaining70 = bvSalesTotal - bvIncentive30;

    const totalSales = staffStats.reduce((sum, s) => sum + s.salesAmount, 0);
    const totalIncentive30 = staffStats.reduce((sum, s) => sum + s.incentive30, 0);
    const totalStoreRemaining70 = staffStats.reduce((sum, s) => sum + s.storeRemaining70, 0);
    const totalCraftItems = staffStats.reduce((sum, s) => sum + s.craftItemsCount, 0);
    const totalBonusPayout = staffStats.reduce((sum, s) => sum + s.bonusAmount, 0);
    const totalUnpaidCarryover = staffStats.reduce((sum, s) => sum + s.previousUnpaidBonusTotal, 0);
    const totalDuePayout = staffStats.reduce((sum, s) => sum + s.totalDueAmount, 0);
    const totalRemainingDuePayout = staffStats.reduce((sum, s) => sum + s.remainingDueAmount, 0);

    return {
      weekKey,
      weekLabel,
      startDate,
      endDate,
      isCurrentWeek,
      isFinalized,
      finalizedAt,
      finalizedBy,
      sakura: {
        salesAmount: sakuraSalesTotal,
        incentive30: sakuraIncentive30,
        storeRemaining70: sakuraStoreRemaining70,
        craftItemsCount: staffStats.reduce((sum, s) => sum + s.craftItemsCount, 0),
        itemsSold: staffStats.reduce((sum, s) => sum + s.sakuraItemsSold, 0),
      },
      buonViaggio: {
        salesAmount: bvSalesTotal,
        incentive30: bvIncentive30,
        storeRemaining70: bvStoreRemaining70,
        craftItemsCount: 0,
        itemsSold: staffStats.reduce((sum, s) => sum + s.buonViaggioItemsSold, 0),
      },
      totalSales,
      totalIncentive30,
      totalStoreRemaining70,
      totalCraftItems,
      totalBonusPayout,
      totalUnpaidCarryover,
      totalDuePayout,
      totalRemainingDuePayout,
      staffStats,
    };
  };

  // 週ボーナスの保存
  const saveWeeklyBonus = (
    weekKey: string,
    staffBonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean; paidAt?: string } }
  ) => {
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      const mergedBonuses = { ...existing.bonuses };
      Object.keys(staffBonuses).forEach((uId) => {
        mergedBonuses[uId] = {
          ...(mergedBonuses[uId] || {}),
          ...staffBonuses[uId],
        };
      });
      const updated = {
        ...prev,
        [weekKey]: {
          ...existing,
          bonuses: mergedBonuses,
        },
      };
      syncStateToCloud("weekly_bonuses", updated);
      return updated;
    });
  };

  // 週ボーナスの確定
  const finalizeWeeklyBonus = (weekKey: string) => {
    const caller = currentUser ? currentUser.displayName : "kein";
    const nowIso = new Date().toISOString();
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      const updated = {
        ...prev,
        [weekKey]: {
          ...existing,
          isFinalized: true,
          finalizedAt: nowIso,
          finalizedBy: caller,
        },
      };
      syncStateToCloud("weekly_bonuses", updated);
      return updated;
    });
    logAction({
      category: "bonus",
      title: `週次ボーナスの確定 (${weekKey})`,
      detail: `店主「${caller}」がこの週のボーナス支給額を確定しました`,
    });
  };

  // 週ボーナス確定の解除
  const unfinalizeWeeklyBonus = (weekKey: string) => {
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [weekKey]: {
          ...existing,
          isFinalized: false,
        },
      };
      syncStateToCloud("weekly_bonuses", updated);
      return updated;
    });
    logAction({
      category: "bonus",
      title: `週次ボーナス確定の解除 (${weekKey})`,
      detail: `店主がボーナス査定の再編集を開始しました`,
    });
  };

  // 特定週・特定スタッフのボーナス支払済フラグ切り替え
  const toggleBonusPaid = (weekKey: string, userId: string, isPaid: boolean) => {
    const caller = currentUser ? currentUser.displayName : "kein";
    const nowIso = new Date().toISOString();

    const currentBonusRecord = weeklyBonuses[weekKey]?.bonuses?.[userId];
    const bonusAmount = currentBonusRecord ? currentBonusRecord.amount : 0;

    if (bonusAmount > 0) {
      if (isPaid) {
        setVaultBalance((prev) => {
          const next = Math.max(0, prev - bonusAmount);
          syncStateToCloud("vault_balance", { balance: next });
          return next;
        });
      } else {
        setVaultBalance((prev) => {
          const next = prev + bonusAmount;
          syncStateToCloud("vault_balance", { balance: next });
          return next;
        });
      }
    }

    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      const currentStaff = existing.bonuses?.[userId] || { amount: 0 };
      const updated = {
        ...prev,
        [weekKey]: {
          ...existing,
          bonuses: {
            ...existing.bonuses,
            [userId]: {
              ...currentStaff,
              isPaid,
              paidAt: isPaid ? nowIso : undefined,
            },
          },
        },
      };
      syncStateToCloud("weekly_bonuses", updated);
      return updated;
    });

    const targetUser = users.find((u) => u.id === userId);
    logAction({
      category: "bonus",
      title: isPaid ? `ボーナス支給済みに変更 (${targetUser?.displayName || userId})` : `ボーナス未払いに戻す (${targetUser?.displayName || userId})`,
      detail: `店主「${caller}」が週「${weekKey}」のボーナス支払状態を【${isPaid ? "支払済" : "未払い"}】に設定しました${bonusAmount > 0 ? ` (金庫: ${isPaid ? `-¥${bonusAmount.toLocaleString()}` : `+¥${bonusAmount.toLocaleString()}`})` : ""}`,
    });

    if (bonusAmount > 0) {
      logAction({
        category: "vault",
        title: isPaid ? `金庫よりボーナス支給出金 (-¥${bonusAmount.toLocaleString()})` : `金庫へボーナス返還入金 (+¥${bonusAmount.toLocaleString()})`,
        detail: `スタッフ「${targetUser?.displayName || userId}」へのボーナス処理に伴い金庫残高を更新しました`,
      });
    }
  };

  // 特定スタッフの過去の未払い週ボーナスを一括精算
  const markAllPastBonusesAsPaid = (userId: string) => {
    const caller = currentUser ? currentUser.displayName : "kein";
    const nowIso = new Date().toISOString();

    let totalUnpaidAmount = 0;
    Object.keys(weeklyBonuses).forEach((wKey) => {
      const staffBonus = weeklyBonuses[wKey]?.bonuses?.[userId];
      if (staffBonus && !staffBonus.isPaid && staffBonus.amount > 0) {
        totalUnpaidAmount += staffBonus.amount;
      }
    });

    if (totalUnpaidAmount > 0) {
      setVaultBalance((prev) => {
        const next = Math.max(0, prev - totalUnpaidAmount);
        syncStateToCloud("vault_balance", { balance: next });
        return next;
      });
    }

    setWeeklyBonuses((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((wKey) => {
        if (updated[wKey]?.bonuses?.[userId]) {
          const staffBonus = updated[wKey].bonuses[userId];
          if (!staffBonus.isPaid && staffBonus.amount > 0) {
            updated[wKey] = {
              ...updated[wKey],
              bonuses: {
                ...updated[wKey].bonuses,
                [userId]: {
                  ...staffBonus,
                  isPaid: true,
                  paidAt: nowIso,
                },
              },
            };
          }
        }
      });
      syncStateToCloud("weekly_bonuses", updated);
      return updated;
    });

    const targetUser = users.find((u) => u.id === userId);
    logAction({
      category: "bonus",
      title: `過去未払いボーナスの一括精算 (${targetUser?.displayName || userId})`,
      detail: `店主「${caller}」がスタッフ「${targetUser?.displayName || userId}」の未払いボーナスを全額一括精算（支払済）にしました${totalUnpaidAmount > 0 ? ` (金庫: -¥${totalUnpaidAmount.toLocaleString()})` : ""}`,
    });

    if (totalUnpaidAmount > 0) {
      logAction({
        category: "vault",
        title: `金庫より未払いボーナス一括出金 (-¥${totalUnpaidAmount.toLocaleString()})`,
        detail: `スタッフ「${targetUser?.displayName || userId}」への過去未払いボーナス一括精算に伴い金庫残高から出金しました`,
      });
    }
  };

  // ゲーム内金庫残高の手動調整
  const updateVaultBalance = (newBalance: number, reason?: string) => {
    const caller = currentUser ? currentUser.displayName : "kein";
    const oldBalance = vaultBalance;
    const cleanBalance = Math.max(0, Math.floor(newBalance));
    const delta = cleanBalance - oldBalance;

    setVaultBalance(cleanBalance);
    syncStateToCloud("vault_balance", { balance: cleanBalance });

    logAction({
      category: "vault",
      title: `金庫残高の手動調整 (現在: ¥${cleanBalance.toLocaleString()})`,
      detail: `店主「${caller}」が金庫残高を【¥${oldBalance.toLocaleString()} ➜ ¥${cleanBalance.toLocaleString()}】(${delta >= 0 ? `+¥${delta.toLocaleString()}` : `-¥${Math.abs(delta).toLocaleString()}`})に手動調整しました${reason ? ` [メモ: ${reason}]` : ""}`,
    });
  };

  const deleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.username === "kein") {
      alert("管理者 kein は削除できません。");
      return;
    }
    const updatedUsers = users.filter((u) => u.id !== userId);
    setUsers(updatedUsers);
    syncStateToCloud("users", updatedUsers);

    logAction({
      category: "user",
      title: "従業員の削除",
      detail: `従業員「${target.displayName}」を削除しました`,
    });
  };

  // 商品 & 素材の分離
  const products = items.filter((i) => i.type === "product");
  const ingredients = items.filter((i) => i.type === "ingredient");

  // 3. メイン画面: 「売る」処理
  const sellProducts = (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ): {
    success: boolean;
    message: string;
  } => {
    const saleEntries = Object.entries(quantities).filter(([_, qty]) => qty > 0);
    if (saleEntries.length === 0) {
      return { success: false, message: "販売する商品の個数を指定してください。" };
    }

    // 在庫チェック
    for (const [itemId, qty] of saleEntries) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      if (item.current_stock < qty) {
        return {
          success: false,
          message: `「${item.name}」の在庫が不足しています。(現在庫: ${item.current_stock}個 / 必要: ${qty}個)`,
        };
      }
    }

    let totalSaleAmount = 0;
    const saleItemsList: { itemId: string; itemName: string; quantity: number; unitPrice: number; subtotal: number }[] = [];
    let determinedShopId: ShopId | undefined = shopId;

    for (const [itemId, orderQty] of saleEntries) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      if (!determinedShopId && item.shopId) {
        determinedShopId = item.shopId;
      }
      const subtotal = item.selling_price * orderQty;
      totalSaleAmount += subtotal;
      saleItemsList.push({
        itemId: item.id,
        itemName: item.name,
        quantity: orderQty,
        unitPrice: item.selling_price,
        subtotal,
      });
    }

    // 在庫の減算（ローカル ＆ クラウド）
    const updatedItemsList: Item[] = [];
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const orderQty = quantities[item.id] || 0;
        if (orderQty > 0) {
          const updated = {
            ...item,
            current_stock: item.current_stock - orderQty,
            updated_at: new Date().toISOString(),
          };
          updatedItemsList.push(updated);
          return updated;
        }
        return item;
      });
    });
    syncItemsBatchToCloud(updatedItemsList);

    const finalShopId: ShopId = determinedShopId || "sakura";
    const shopName = finalShopId === "buon_viaggio" ? "Buon viaggio" : "和食さくら";

    const newSale: Sale = {
      id: `sale-${Date.now().toString().slice(-6)}`,
      shopId: finalShopId,
      staffName: currentUser ? currentUser.displayName : "店員",
      staffUserId: currentUser ? currentUser.id : undefined,
      totalAmount: totalSaleAmount,
      total_amount: totalSaleAmount,
      staff_name: currentUser ? currentUser.displayName : "店員",
      items: saleItemsList,
      created_at: new Date().toISOString(),
    };

    setSales((prev) => [newSale, ...prev]);
    syncSaleToCloud(newSale);

    // 金庫残高への7割入金
    const incentive30 = Math.floor(totalSaleAmount * 0.3);
    const storeRemaining70 = totalSaleAmount - incentive30;

    if (storeRemaining70 > 0) {
      setVaultBalance((prev) => {
        const next = prev + storeRemaining70;
        syncStateToCloud("vault_balance", { balance: next });
        return next;
      });

      logAction({
        category: "vault",
        title: `【${shopName}】金庫売上入金 (店舗7割: +¥${storeRemaining70.toLocaleString()})`,
        detail: `売上伝票「${newSale.id}」(売上総額 ¥${totalSaleAmount.toLocaleString()}) より、スタッフ手渡し3割 (¥${incentive30.toLocaleString()}) を除いた店舗手元純残り7割 (¥${storeRemaining70.toLocaleString()}) を金庫に入金しました`,
      });
    }

    // 操作ログ記録
    const summaryText = saleItemsList.map((s) => `${s.itemName}×${s.quantity}`).join(", ");
    logAction({
      category: "sale",
      title: `【${shopName}】商品の販売 (売上 ¥${totalSaleAmount.toLocaleString()} / 店手元7割 ¥${storeRemaining70.toLocaleString()})`,
      detail: `販売明細: ${summaryText} (在庫減算済)`,
    });

    return {
      success: true,
      message: `【${shopName}】商品を販売しました！売上: ¥${totalSaleAmount.toLocaleString()} (手渡し3割: ¥${incentive30.toLocaleString()} / 金庫入金7割: ¥${storeRemaining70.toLocaleString()})`,
    };
  };

  // 4. メイン画面: 「作成 (在庫を増やす)」処理
  const craftProducts = (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ): {
    success: boolean;
    message: string;
  } => {
    const craftEntries = Object.entries(quantities).filter(([_, qty]) => qty > 0);
    if (craftEntries.length === 0) {
      return { success: false, message: "作成する商品の個数を指定してください。" };
    }

    const requiredIngredients: { [ingId: string]: { name: string; needed: number } } = {};
    let determinedShopId: ShopId | undefined = shopId;

    for (const [itemId, qty] of craftEntries) {
      const prod = items.find((i) => i.id === itemId);
      if (!prod) continue;
      if (!determinedShopId && prod.shopId) {
        determinedShopId = prod.shopId;
      }
      if (!prod.recipe || prod.recipe.length === 0) {
        continue;
      }

      for (const req of prod.recipe) {
        if (!requiredIngredients[req.ingredient_id]) {
          requiredIngredients[req.ingredient_id] = {
            name: req.ingredient_name,
            needed: 0,
          };
        }
        requiredIngredients[req.ingredient_id].needed += req.quantity * qty;
      }
    }

    // 素材在庫チェック
    for (const [ingId, req] of Object.entries(requiredIngredients)) {
      const ingItem = items.find((i) => i.id === ingId);
      const currentStock = ingItem ? ingItem.current_stock : 0;
      if (currentStock < req.needed) {
        return {
          success: false,
          message: `作成に必要な素材「${req.name}」が不足しています！(現在庫: ${currentStock}個 / 必要: ${req.needed}個)`,
        };
      }
    }

    // 素材減算 ＆ 商品加算
    const updatedItemsList: Item[] = [];
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const craftQty = quantities[item.id] || 0;
        if (craftQty > 0) {
          const updated = {
            ...item,
            current_stock: item.current_stock + craftQty,
            updated_at: new Date().toISOString(),
          };
          updatedItemsList.push(updated);
          return updated;
        }

        const consumed = requiredIngredients[item.id];
        if (consumed) {
          const updated = {
            ...item,
            current_stock: item.current_stock - consumed.needed,
            updated_at: new Date().toISOString(),
          };
          updatedItemsList.push(updated);
          return updated;
        }

        return item;
      });
    });
    syncItemsBatchToCloud(updatedItemsList);

    const finalShopId: ShopId = determinedShopId || "sakura";
    const shopName = finalShopId === "buon_viaggio" ? "Buon viaggio" : "和食さくら";

    const craftedList = craftEntries
      .map(([id, qty]) => {
        const it = items.find((i) => i.id === id);
        return `${it?.name}×${qty}`;
      })
      .join(", ");

    const consumedList = Object.values(requiredIngredients)
      .map((c) => `${c.name}×${c.needed}`)
      .join(", ");

    logAction({
      category: "craft",
      title: `【${shopName}】商品の作成・クラフト (${craftedList})`,
      detail: `商品在庫を増やしました。消費した素材: ${consumedList || "なし (レシピ未設定)"}`,
    });

    return {
      success: true,
      message: `商品を作成しました！在庫が増加し、必要な素材を自動で消費しました。`,
    };
  };

  // 誤操作取り消し: 売上伝票の取り消し（在庫復元 ＆ 金庫7割出金）
  const cancelSale = (saleId: string): { success: boolean; message: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) {
      return { success: false, message: "対象の売上伝票が見つかりません。" };
    }

    // 1. 売った商品在庫を元に戻す（加算復元）
    const restoredItems: Item[] = [];
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const soldItem = sale.items.find((si) => (si.itemId || si.item_id) === item.id);
        if (soldItem && soldItem.quantity > 0) {
          const restored = {
            ...item,
            current_stock: item.current_stock + soldItem.quantity,
            updated_at: new Date().toISOString(),
          };
          restoredItems.push(restored);
          return restored;
        }
        return item;
      });
    });
    syncItemsBatchToCloud(restoredItems);

    // 2. 金庫から売上7割（店舗手元純残り）を差し引く
    const totalAmount = sale.totalAmount ?? sale.total_amount ?? 0;
    const incentive30 = Math.floor(totalAmount * 0.3);
    const storeRemaining70 = totalAmount - incentive30;

    if (storeRemaining70 > 0) {
      setVaultBalance((prev) => {
        const next = Math.max(0, prev - storeRemaining70);
        syncStateToCloud("vault_balance", { balance: next });
        return next;
      });
    }

    // 3. 売上伝票の削除
    setSales((prev) => prev.filter((s) => s.id !== saleId));
    if (supabase) {
      supabase.from("sakura_sales").delete().eq("id", saleId).then();
    }

    // 4. 操作ログの記録
    const caller = currentUser ? currentUser.displayName : "店員";
    const shopName = sale.shopId === "buon_viaggio" ? "Buon viaggio" : "和食さくら";
    const itemSummary = sale.items.map((it) => `${it.itemName || it.item_name}×${it.quantity}`).join(", ");

    logAction({
      category: "sale",
      title: `【${shopName}】売上伝票 #${sale.id} の取り消し`,
      detail: `「${caller}」が売上伝票を取り消しました。商品在庫を復元（${itemSummary}）、金庫から売上7割分 (-¥${storeRemaining70.toLocaleString()}) を差し引きました`,
    });

    return {
      success: true,
      message: `売上伝票 #${sale.id} を取り消しました！商品在庫を元に戻し、金庫の売上分 (¥${storeRemaining70.toLocaleString()}) を減額しました。`,
    };
  };

  // 誤操作取り消し: クラフト作成の取り消し（完成品在庫を減らし、消費した素材を元に戻す）
  const rollbackCraftItems = (
    quantities: { [itemId: string]: number },
    shopId?: ShopId
  ): { success: boolean; message: string } => {
    const entries = Object.entries(quantities).filter(([_, qty]) => qty > 0);
    if (entries.length === 0) {
      return { success: false, message: "取り消す商品の個数を指定してください。" };
    }

    // 1. レシピから消費した素材量を逆算
    const restoredIngredients: { [ingId: string]: { name: string; amount: number } } = {};
    for (const [itemId, qty] of entries) {
      const prod = items.find((i) => i.id === itemId);
      if (!prod || !prod.recipe) continue;
      for (const req of prod.recipe) {
        if (!restoredIngredients[req.ingredient_id]) {
          restoredIngredients[req.ingredient_id] = { name: req.ingredient_name, amount: 0 };
        }
        restoredIngredients[req.ingredient_id].amount += req.quantity * qty;
      }
    }

    // 2. 商品在庫を減算 ＆ 素材在庫を加算（復元）
    const updatedItemsList: Item[] = [];
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const craftQty = quantities[item.id] || 0;
        if (craftQty > 0) {
          const updated = {
            ...item,
            current_stock: Math.max(0, item.current_stock - craftQty),
            updated_at: new Date().toISOString(),
          };
          updatedItemsList.push(updated);
          return updated;
        }

        const restored = restoredIngredients[item.id];
        if (restored) {
          const updated = {
            ...item,
            current_stock: item.current_stock + restored.amount,
            updated_at: new Date().toISOString(),
          };
          updatedItemsList.push(updated);
          return updated;
        }

        return item;
      });
    });
    syncItemsBatchToCloud(updatedItemsList);

    const caller = currentUser ? currentUser.displayName : "店員";
    const finalShopId: ShopId = shopId || "sakura";
    const shopName = finalShopId === "buon_viaggio" ? "Buon viaggio" : "和食さくら";

    const rolledList = entries
      .map(([id, qty]) => {
        const it = items.find((i) => i.id === id);
        return `${it?.name}×${qty}`;
      })
      .join(", ");

    const restoredList = Object.values(restoredIngredients)
      .map((c) => `${c.name}×${c.amount}`)
      .join(", ");

    logAction({
      category: "craft",
      title: `【${shopName}】クラフト作成の取り消し (${rolledList})`,
      detail: `「${caller}」がクラフトを取り消しました。商品在庫を減算し、消費した素材を元に戻しました (${restoredList || "なし"})`,
    });

    return {
      success: true,
      message: `クラフト作成を取り消しました！商品在庫を減らし、消費した素材（${restoredList || "なし"}）を完全に復元しました。`,
    };
  };

  // 操作ログからクラフトを取り消す
  const cancelCraftByLog = (logId: string): { success: boolean; message: string } => {
    const log = actionLogs.find((l) => l.id === logId);
    if (!log) {
      return { success: false, message: "対象のログが見つかりません。" };
    }

    // ログタイトルから商品名と数量を抽出 (例: "桜特上握り寿司×3")
    const toRollback: { [itemId: string]: number } = {};
    for (const item of items) {
      if (item.type === "product") {
        const regex = new RegExp(`${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}×(\\d+)`);
        const match = log.title.match(regex);
        if (match) {
          toRollback[item.id] = parseInt(match[1], 10) || 1;
        }
      }
    }

    if (Object.keys(toRollback).length === 0) {
      return { success: false, message: "ログからクラフト商品の特定ができませんでした。" };
    }

    const res = rollbackCraftItems(toRollback);
    if (res.success) {
      // 当該ログも削除
      setActionLogs((prev) => prev.filter((l) => l.id !== logId));
      if (supabase) {
        supabase.from("sakura_action_logs").delete().eq("id", logId).then();
      }
    }
    return res;
  };

  // 5. 幹部設定機能
  const addItem = (itemData: Omit<Item, "id" | "created_at" | "updated_at">) => {
    const newItem: Item = {
      ...itemData,
      id: `${itemData.type === "product" ? "prd" : "ing"}-${Date.now().toString().slice(-5)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    syncItemToCloud(newItem);

    logAction({
      category: "product",
      title: `新規${itemData.type === "product" ? "商品" : "素材"}の登録`,
      detail: `「${newItem.name}」を登録しました (初期在庫: ${newItem.current_stock}${newItem.unit})`,
    });
  };

  const updateItem = (itemId: string, updates: Partial<Item>) => {
    const target = items.find((i) => i.id === itemId);
    let updatedItem: Item | null = null;

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          updatedItem = { ...i, ...updates, updated_at: new Date().toISOString() };
          return updatedItem;
        }
        return i;
      })
    );
    if (updatedItem) {
      syncItemToCloud(updatedItem);
    }

    if (target) {
      logAction({
        category: "product",
        title: `${target.type === "product" ? "料理商品" : "素材"}情報の変更 (${target.name})`,
        detail: `「${target.name}」の内容を変更しました (${Object.keys(updates).join(", ")})`,
      });
    }
  };

  const deleteItem = (itemId: string): { success: boolean; message: string } => {
    const target = items.find((i) => i.id === itemId);
    if (!target) return { success: false, message: "対象の品目が見つかりません。" };

    const usedInRecipes = items.filter(
      (p) => p.recipe && p.recipe.some((r) => r.ingredient_id === itemId)
    );
    if (usedInRecipes.length > 0) {
      const names = usedInRecipes.map((p) => p.name).join("、");
      return {
        success: false,
        message: `「${target.name}」は【${names}】の作成レシピ必要素材として登録されているため削除できません。先にレシピから外してください。`,
      };
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    deleteItemFromCloud(itemId);

    logAction({
      category: "product",
      title: `${target.type === "product" ? "料理商品" : "素材"}の削除`,
      detail: `「${target.name}」を店舗メニュー・在庫から完全に削除しました`,
    });

    return { success: true, message: `「${target.name}」を削除しました。` };
  };

  const updatePrice = (itemId: string, newPrice: number) => {
    let updatedItem: Item | null = null;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "recipe",
            title: "販売価格の変更",
            detail: `「${i.name}」の値段を ¥${i.selling_price.toLocaleString()} → ¥${newPrice.toLocaleString()} に変更しました`,
          });
          updatedItem = { ...i, selling_price: newPrice, updated_at: new Date().toISOString() };
          return updatedItem;
        }
        return i;
      })
    );
    if (updatedItem) syncItemToCloud(updatedItem);
  };

  const updateRecipe = (itemId: string, recipe: RecipeRequirement[]) => {
    let updatedItem: Item | null = null;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          const recipeDesc = recipe.map((r) => `${r.ingredient_name}×${r.quantity}`).join(", ");
          logAction({
            category: "recipe",
            title: `レシピの変更 (${i.name})`,
            detail: `必要素材を設定: ${recipeDesc || "なし"}`,
          });
          updatedItem = { ...i, recipe, updated_at: new Date().toISOString() };
          return updatedItem;
        }
        return i;
      })
    );
    if (updatedItem) syncItemToCloud(updatedItem);
  };

  const updateItemImage = (itemId: string, imageUrl: string) => {
    let updatedItem: Item | null = null;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "product",
            title: `画像の更新 (${i.name})`,
            detail: `商品・素材の画像を更新しました`,
          });
          updatedItem = { ...i, image_url: imageUrl, updated_at: new Date().toISOString() };
          return updatedItem;
        }
        return i;
      })
    );
    if (updatedItem) syncItemToCloud(updatedItem);
  };

  const adjustStock = (itemId: string, newStock: number, reason: string = "手動調整") => {
    let updatedItem: Item | null = null;
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "inventory",
            title: `在庫数の手動調整 (${i.name})`,
            detail: `在庫数を ${i.current_stock} → ${newStock}${i.unit} に調整 (理由: ${reason})`,
          });
          updatedItem = { ...i, current_stock: newStock, updated_at: new Date().toISOString() };
          return updatedItem;
        }
        return i;
      })
    );
    if (updatedItem) syncItemToCloud(updatedItem);
  };

  return (
    <AppContext.Provider
      value={{
        syncStatus,
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        users,
        addUser,
        updateUserPass,
        updateUserRole,
        updateUserBonus,
        updateUsersOrder,
        deleteUser,
        getStaffPerformances,
        storeSettings,
        updateStoreSettings,
        roles,
        addRole,
        updateRole,
        deleteRole,
        updateUserCustomRole,
        getWeeklySummary,
        saveWeeklyBonus,
        finalizeWeeklyBonus,
        unfinalizeWeeklyBonus,
        toggleBonusPaid,
        markAllPastBonusesAsPaid,
        items,
        products,
        ingredients,
        sellProducts,
        craftProducts,
        addItem,
        updateItem,
        deleteItem,
        updatePrice,
        updateRecipe,
        updateItemImage,
        adjustStock,
        sales,
        actionLogs,
        logAction,
        vaultBalance,
        updateVaultBalance,
        cancelSale,
        rollbackCraftItems,
        cancelCraftByLog,
        refreshData,
        addSale: async (saleData: any): Promise<Sale> => {
          const totalAmt = saleData.total_amount || saleData.totalAmount || 0;
          const newSale: Sale = {
            id: `sale-${Date.now().toString().slice(-6)}`,
            shopId: "sakura",
            staffName: currentUser ? currentUser.displayName : "店員",
            staffUserId: currentUser ? currentUser.id : undefined,
            totalAmount: totalAmt,
            total_amount: totalAmt,
            staff_name: currentUser ? currentUser.displayName : "店員",
            items: (saleData.items || []).map((it: any) => ({
              itemId: it.item_id || it.itemId || "",
              itemName: it.item_name || it.itemName || "",
              quantity: it.quantity || 1,
              unitPrice: it.unit_price || it.unitPrice || 0,
              subtotal: (it.unit_price || it.unitPrice || 0) * (it.quantity || 1),
              item_id: it.item_id || it.itemId || "",
              item_name: it.item_name || it.itemName || "",
            })),
            created_at: new Date().toISOString(),
          };
          setSales((prev) => [newSale, ...prev]);
          syncSaleToCloud(newSale);
          return newSale;
        },
        recordStockTransaction: (params: any) => {
          const itemId = typeof params === "object" ? params.itemId || params.item_id : params;
          const qty = typeof params === "object" ? params.quantity || 0 : arguments[2] || 0;
          const reason = typeof params === "object" ? params.reason : arguments[3] || "手動調整";
          const type = typeof params === "object" ? params.type : arguments[1];
          const delta = type === "inbound" ? qty : -qty;

          const item = items.find((i) => i.id === itemId);
          if (item) {
            adjustStock(itemId, Math.max(0, item.current_stock + delta), reason);
          }
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
