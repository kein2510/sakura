"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
} from "@/types";
import {
  mockStaffUsers,
  initialItems,
  initialActionLogs,
  initialSales,
} from "@/data/mockData";
import { getRecentWeeks, isDateInWeek, WeekPeriod } from "@/lib/dateUtils";
import { supabase } from "@/lib/supabase";

export const defaultCustomRoles: CustomRole[] = [
  {
    id: "role-owner",
    name: "店主 (オーナー)",
    color: "amber",
    isExecutive: true,
    description: "店舗最高責任者・全権限（kein）",
    isDefault: false,
  },
  {
    id: "role-manager",
    name: "店長 / 幹部",
    color: "rose",
    isExecutive: true,
    description: "店舗運営・管理業務・ボーナス査定",
    isDefault: false,
  },
  {
    id: "role-chef",
    name: "料理長",
    color: "emerald",
    isExecutive: false,
    description: "厨房統括・仕込み・クラフト責任者",
    isDefault: false,
  },
  {
    id: "role-staff",
    name: "一般スタッフ",
    color: "blue",
    isExecutive: false,
    description: "ホール接客・調理作成・レジ販売",
    isDefault: true,
  },
  {
    id: "role-parttime",
    name: "アルバイト / 見習い",
    color: "emerald",
    isExecutive: false,
    description: "仕込み補助・接客サポート",
    isDefault: false,
  },
];

interface AppContextType {
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
  deleteUser: (userId: string) => void;
  getStaffPerformances: () => StaffPerformance[];

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
    staffBonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean } }
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

  // 互換用メソッド
  addSale: (saleData: any) => Promise<Sale>;
  recordStockTransaction: (params: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // 役職・カスタムロール状態
  const [roles, setRoles] = useState<CustomRole[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_roles");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return defaultCustomRoles;
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
    // 全ユーザーに roleId と roleName を確実に紐づけ
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

  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_session");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    // 初期状態で kein (001) でログイン済みとして起動し、すぐに使える状態にする
    const keinUser = mockStaffUsers[0];
    return {
      ...keinUser,
      role: "executive",
      roleId: "role-owner",
      roleName: "店主 (オーナー)",
    };
  });

  // アイテム・在庫状態
  const [items, setItems] = useState<Item[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_items");
      if (saved) {
        try {
          const parsed: Item[] = JSON.parse(saved);
          const existingIds = new Set(parsed.map((i) => i.id));
          // 新しく mockData に追加された Buon viaggio 商品や素材があれば追加マージ
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
  const [actionLogs, setActionLogs] = useState<ActionLog[]>(initialActionLogs);

  // 週次ボーナス確定データ { [weekKey]: { isFinalized, finalizedAt, finalizedBy, bonuses: { [userId]: { amount, note, isPaid, paidAt } } } }
  const [weeklyBonuses, setWeeklyBonuses] = useState<{
    [weekKey: string]: {
      isFinalized: boolean;
      finalizedAt?: string;
      finalizedBy?: string;
      bonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean; paidAt?: string } };
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
    // 初期サンプル: 直近の締め週のデータ
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

  // ゲーム内金庫残高 (localStorage保存)
  const [vaultBalance, setVaultBalance] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fivem_sakura_vault_balance");
      if (saved !== null) {
        const num = parseInt(saved, 10);
        if (!isNaN(num)) return num;
      }
    }
    return 3000000; // 初期サンプル金庫残高: ¥3,000,000
  });

  // ローカル永続化
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
      localStorage.setItem("fivem_sakura_items", JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (currentUser) {
        localStorage.setItem("fivem_sakura_session", JSON.stringify(currentUser));
      } else {
        localStorage.removeItem("fivem_sakura_session");
      }
    }
  }, [currentUser]);

  // 操作ログの追加
  const logAction = ({
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
  };

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
    setUsers((prev) => [...prev, newUser]);
    logAction({
      category: "user",
      title: "従業員の追加",
      detail: `新しい従業員「${newUser.displayName} (PASS: ${newUser.pass} / 役職: ${newUser.roleName || "一般スタッフ"})」を登録しました`,
    });
  };

  const updateUserPass = (userId: string, newPass: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, pass: newPass.trim() };
          logAction({
            category: "user",
            title: "PASSの変更",
            detail: `「${u.displayName}」のログインPASSを変更しました`,
          });
          return updated;
        }
        return u;
      })
    );
  };

  const updateUserRole = (userId: string, role: Role) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, role };
          logAction({
            category: "user",
            title: "権限の変更",
            detail: `「${u.displayName}」の権限を「${role === "executive" ? "幹部" : "スタッフ"}」に変更しました`,
          });
          return updated;
        }
        return u;
      })
    );
  };

  // 役職・カスタムロールの管理
  const addRole = (roleData: Omit<CustomRole, "id">) => {
    const newRole: CustomRole = {
      ...roleData,
      id: `role-${Date.now().toString().slice(-5)}`,
    };
    setRoles((prev) => [...prev, newRole]);
    logAction({
      category: "role",
      title: `役職「${newRole.name}」の新規作成`,
      detail: `権限: ${newRole.isExecutive ? "幹部権限あり" : "一般スタッフ"} / 表示色: ${newRole.color} / 説明: ${newRole.description || "なし"}`,
    });
  };

  const updateRole = (roleId: string, updates: Partial<CustomRole>) => {
    const target = roles.find((r) => r.id === roleId);
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, ...updates } : r))
    );
    // 該当ロールを持つ全スタッフの role / roleName を同期更新
    setUsers((prev) =>
      prev.map((u) => {
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
      })
    );
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
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
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
    setUsers((prev) =>
      prev.map((u) => {
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
      })
    );
    logAction({
      category: "user",
      title: `従業員役職の変更`,
      detail: `「${targetUser?.displayName || userId}」の役職を「${role.name}」(${role.isExecutive ? "幹部権限" : "一般スタッフ"})に変更しました`,
    });
  };

  const updateUserBonus = (userId: string, bonusAmount: number, note?: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = {
            ...u,
            bonusAmount: Math.max(0, bonusAmount),
            bonusNote: note !== undefined ? note : u.bonusNote,
          };
          logAction({
            category: "bonus",
            title: `ボーナス査定の変更 (${u.displayName})`,
            detail: `支給額を ¥${bonusAmount.toLocaleString()} に設定しました ${note ? `[評価メモ: ${note}]` : ""}`,
          });
          return updated;
        }
        return u;
      })
    );
  };

  const getStaffPerformances = (): StaffPerformance[] => {
    return users.map((u) => {
      // 1. 売上集計 (IDまたは名前で突合)
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

      // 2. クラフト（料理作成）貢献度集計
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

      // 3. 在庫手動調整・補充回数
      const inventoryAdjustCount = actionLogs.filter(
        (l) => l.userName === u.displayName && l.category === "inventory"
      ).length;

      // 4. 最終アクション日時
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

  // 週次サマリー取得（日曜始まり土曜締め）
  const getWeeklySummary = (targetWeekKey?: string): WeeklySummary => {
    const recentWeeks = getRecentWeeks(8);
    const activeWeek = targetWeekKey
      ? recentWeeks.find((w) => w.weekKey === targetWeekKey) || recentWeeks[0]
      : recentWeeks[1] || recentWeeks[0];

    const { weekKey, weekLabel, startDate, endDate, isCurrentWeek } = activeWeek;

    // その週の売上伝票を抽出
    const weekSales = sales.filter((s) => isDateInWeek(s.created_at, startDate, endDate));

    // その週のクラフト・在庫調整ログを抽出
    const weekLogs = actionLogs.filter((l) => isDateInWeek(l.created_at, startDate, endDate));

    // 確定記録
    const savedRecord = weeklyBonuses[weekKey];
    const isFinalized = Boolean(savedRecord?.isFinalized);
    const finalizedAt = savedRecord?.finalizedAt;
    const finalizedBy = savedRecord?.finalizedBy;

    // スタッフ別実績の計算
    const staffStats: StaffWeeklyStat[] = users.map((u) => {
      // 1. 売上集計 (全体 + 各店舗別)
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

      // 2. 3割インセンティブと残り7割
      const incentive30 = Math.floor(salesAmount * 0.3);
      const storeRemaining70 = salesAmount - incentive30;

      // 3. クラフト数
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

      // 4. 在庫調整
      const inventoryAdjustCount = weekLogs.filter(
        (l) => l.userName === u.displayName && l.category === "inventory"
      ).length;

      // 5. 保存ボーナス & 支払状態
      const savedUserBonus = savedRecord?.bonuses?.[u.id];
      const bonusAmount = savedUserBonus ? savedUserBonus.amount : (u.bonusAmount || 0);
      const bonusNote = savedUserBonus ? savedUserBonus.note : (u.bonusNote || "");
      const isPaid = savedUserBonus ? Boolean(savedUserBonus.isPaid) : false;
      const paidAt = savedUserBonus?.paidAt;

      // 6. 過去の確定済み未払い合算（キャリーオーバー）の集計
      let previousUnpaidBonusTotal = 0;
      const previousUnpaidWeeks: { weekKey: string; weekLabel: string; amount: number }[] = [];

      Object.entries(weeklyBonuses).forEach(([pastKey, pastRecord]) => {
        if (pastKey === weekKey) return; // 現在選択中の週は除外
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

      // 合計支払い予定額 (今週決定分 + 過去未払い分)
      const totalDueAmount = bonusAmount + previousUnpaidBonusTotal;

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
        bonusAmount,
        bonusNote,
        isPaid,
        paidAt,
        previousUnpaidBonusTotal,
        previousUnpaidWeeks,
        totalDueAmount,
        weekSales: userSales,
      };
    });

    // 店舗別実績の集計
    const sakuraSalesTotal = staffStats.reduce((sum, s) => sum + s.sakuraSalesAmount, 0);
    const sakuraIncentive30 = Math.floor(sakuraSalesTotal * 0.3);
    const sakuraStoreRemaining70 = sakuraSalesTotal - sakuraIncentive30;

    const bvSalesTotal = staffStats.reduce((sum, s) => sum + s.buonViaggioSalesAmount, 0);
    const bvIncentive30 = Math.floor(bvSalesTotal * 0.3);
    const bvStoreRemaining70 = bvSalesTotal - bvIncentive30;

    // 店舗全体合計
    const totalSales = staffStats.reduce((sum, s) => sum + s.salesAmount, 0);
    const totalIncentive30 = staffStats.reduce((sum, s) => sum + s.incentive30, 0);
    const totalStoreRemaining70 = staffStats.reduce((sum, s) => sum + s.storeRemaining70, 0);
    const totalCraftItems = staffStats.reduce((sum, s) => sum + s.craftItemsCount, 0);
    const totalBonusPayout = staffStats.reduce((sum, s) => sum + s.bonusAmount, 0);
    const totalUnpaidCarryover = staffStats.reduce((sum, s) => sum + s.previousUnpaidBonusTotal, 0);
    const totalDuePayout = staffStats.reduce((sum, s) => sum + s.totalDueAmount, 0);

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
      staffStats,
    };
  };

  // 週ボーナスの保存
  const saveWeeklyBonus = (
    weekKey: string,
    staffBonuses: { [userId: string]: { amount: number; note?: string; isPaid?: boolean } }
  ) => {
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      return {
        ...prev,
        [weekKey]: {
          ...existing,
          bonuses: {
            ...existing.bonuses,
            ...staffBonuses,
          },
        },
      };
    });
  };

  // 週ボーナスの確定
  const finalizeWeeklyBonus = (weekKey: string) => {
    const caller = currentUser ? currentUser.displayName : "kein";
    const nowIso = new Date().toISOString();
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      return {
        ...prev,
        [weekKey]: {
          ...existing,
          isFinalized: true,
          finalizedAt: nowIso,
          finalizedBy: caller,
        },
      };
    });
    logAction({
      category: "bonus",
      title: `週次ボーナスの確定 (${weekKey})`,
      detail: `店主「${caller}」がこの週のボーナス支給額を確定しました`,
    });
  };

  // 週ボーナス確定の解除（編集再開用）
  const unfinalizeWeeklyBonus = (weekKey: string) => {
    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey];
      if (!existing) return prev;
      return {
        ...prev,
        [weekKey]: {
          ...existing,
          isFinalized: false,
        },
      };
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

    // 金庫残高への自動連動: 支払済にした場合は金庫から出金、未払いに戻した場合は金庫へ返還
    if (bonusAmount > 0) {
      if (isPaid) {
        setVaultBalance((prev) => Math.max(0, prev - bonusAmount));
      } else {
        setVaultBalance((prev) => prev + bonusAmount);
      }
    }

    setWeeklyBonuses((prev) => {
      const existing = prev[weekKey] || { isFinalized: false, bonuses: {} };
      const currentStaff = existing.bonuses?.[userId] || { amount: 0 };
      return {
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

  // 特定スタッフの過去の未払い週ボーナスを一括精算（すべて支払済にする）
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
      setVaultBalance((prev) => Math.max(0, prev - totalUnpaidAmount));
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
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    logAction({
      category: "user",
      title: "従業員の削除",
      detail: `従業員「${target.displayName}」を削除しました`,
    });
  };

  // 商品 & 素材の分離
  const products = items.filter((i) => i.type === "product");
  const ingredients = items.filter((i) => i.type === "ingredient");

  // 3. メイン画面: 「売る」処理 (商品の在庫を減らして売上を計上)
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

    // 1. 売上集計と明細作成（setItemsの外で1回のみ計算して二重計上を防ぐ）
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

    // 2. 在庫の減算（純粋なstate更新）
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const orderQty = quantities[item.id] || 0;
        if (orderQty > 0) {
          return {
            ...item,
            current_stock: item.current_stock - orderQty,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });
    });

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

    // 3. ゲーム内金庫残高へ「店舗手元純残り (7割)」を自動反映
    // ※ インセンティブ3割はゲーム内でスタッフへ手渡しするため、金庫には残りの7割が入金されます
    const incentive30 = Math.floor(totalSaleAmount * 0.3);
    const storeRemaining70 = totalSaleAmount - incentive30;

    if (storeRemaining70 > 0) {
      setVaultBalance((prev) => prev + storeRemaining70);
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

  // 4. メイン画面: 「作成 (在庫を増やす)」処理 (素材を自動減算して商品在庫をUP)
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

    // 全作成に必要な素材の合計量を計算
    const requiredIngredients: { [ingId: string]: { name: string; needed: number } } = {};
    let determinedShopId: ShopId | undefined = shopId;

    for (const [itemId, qty] of craftEntries) {
      const prod = items.find((i) => i.id === itemId);
      if (!prod) continue;
      if (!determinedShopId && prod.shopId) {
        determinedShopId = prod.shopId;
      }
      if (!prod.recipe || prod.recipe.length === 0) {
        // レシピ未設定の商品でも作成可能（素材消費なし）
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

    // 素材の在庫チェック
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

    // 素材の在庫減算 ＆ 商品の在庫加算
    setItems((prevItems) => {
      return prevItems.map((item) => {
        // 1) 商品の在庫を増やす
        const craftQty = quantities[item.id] || 0;
        if (craftQty > 0) {
          return {
            ...item,
            current_stock: item.current_stock + craftQty,
            updated_at: new Date().toISOString(),
          };
        }

        // 2) 素材の在庫を減らす
        const consumed = requiredIngredients[item.id];
        if (consumed) {
          return {
            ...item,
            current_stock: item.current_stock - consumed.needed,
            updated_at: new Date().toISOString(),
          };
        }

        return item;
      });
    });

    const finalShopId: ShopId = determinedShopId || "sakura";
    const shopName = finalShopId === "buon_viaggio" ? "Buon viaggio" : "和食さくら";

    // ログ記録
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

  // 5. 幹部設定機能
  const addItem = (itemData: Omit<Item, "id" | "created_at" | "updated_at">) => {
    const newItem: Item = {
      ...itemData,
      id: `${itemData.type === "product" ? "prd" : "ing"}-${Date.now().toString().slice(-5)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    logAction({
      category: "product",
      title: `新規${itemData.type === "product" ? "商品" : "素材"}の登録`,
      detail: `「${newItem.name}」を登録しました (初期在庫: ${newItem.current_stock}${newItem.unit})`,
    });
  };

  const updateItem = (itemId: string, updates: Partial<Item>) => {
    const target = items.find((i) => i.id === itemId);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates, updated_at: new Date().toISOString() } : i))
    );
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

    // レシピで素材として使われているかチェック
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
    logAction({
      category: "product",
      title: `${target.type === "product" ? "料理商品" : "素材"}の削除`,
      detail: `「${target.name}」を店舗メニュー・在庫から完全に削除しました`,
    });

    return { success: true, message: `「${target.name}」を削除しました。` };
  };

  const updatePrice = (itemId: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "recipe",
            title: "販売価格の変更",
            detail: `「${i.name}」の値段を ¥${i.selling_price.toLocaleString()} → ¥${newPrice.toLocaleString()} に変更しました`,
          });
          return { ...i, selling_price: newPrice, updated_at: new Date().toISOString() };
        }
        return i;
      })
    );
  };

  const updateRecipe = (itemId: string, recipe: RecipeRequirement[]) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          const recipeDesc = recipe.map((r) => `${r.ingredient_name}×${r.quantity}`).join(", ");
          logAction({
            category: "recipe",
            title: `レシピの変更 (${i.name})`,
            detail: `必要素材を設定: ${recipeDesc || "なし"}`,
          });
          return { ...i, recipe, updated_at: new Date().toISOString() };
        }
        return i;
      })
    );
  };

  const updateItemImage = (itemId: string, imageUrl: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "product",
            title: `画像の更新 (${i.name})`,
            detail: `商品・素材の画像を更新しました`,
          });
          return { ...i, image_url: imageUrl, updated_at: new Date().toISOString() };
        }
        return i;
      })
    );
  };

  const adjustStock = (itemId: string, newStock: number, reason: string = "手動調整") => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          logAction({
            category: "inventory",
            title: `在庫数の手動調整 (${i.name})`,
            detail: `在庫数を ${i.current_stock} → ${newStock}${i.unit} に調整 (理由: ${reason})`,
          });
          return { ...i, current_stock: newStock, updated_at: new Date().toISOString() };
        }
        return i;
      })
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        users,
        addUser,
        updateUserPass,
        updateUserRole,
        updateUserBonus,
        deleteUser,
        getStaffPerformances,
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
        addSale: async (saleData: any): Promise<Sale> => {
          const totalAmt = saleData.total_amount || saleData.totalAmount || 0;
          const newSale: Sale = {
            id: `sale-${Date.now().toString().slice(-6)}`,
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
