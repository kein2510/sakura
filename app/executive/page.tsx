"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Users,
  UserPlus,
  Key,
  Trash2,
  Edit,
  Edit2,
  Save,
  Plus,
  Minus,
  Sparkles,
  Utensils,
  Layers,
  History,
  Image as ImageIcon,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronRight,
  Shield,
  ArrowRight,
  Coins,
  Award,
  TrendingUp,
  Calculator,
  FileText,
  Check,
  Calendar,
  CheckCheck,
  RefreshCw,
  Tag,
  Palette,
  Store,
  Landmark,
  Radio,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import ImageUploader from "@/components/ImageUploader";
import {
  RecipeRequirement,
  Role,
  CustomRole,
  Item,
  StaffPerformance,
  WeeklySummary,
  StaffWeeklyStat,
  ShopId,
  SHOPS,
} from "@/types";
import { getRecentWeeks, WeekPeriod } from "@/lib/dateUtils";

export default function ExecutivePage() {
  const {
    currentUser,
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
    sales,
    items,
    products,
    ingredients,
    updatePrice,
    updateRecipe,
    addItem,
    updateItem,
    deleteItem,
    updateItemImage,
    actionLogs,
    vaultBalance,
    updateVaultBalance,
    refreshData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "bonus" | "recipes" | "items" | "logs">("users");
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // 幹部ページの Supabase Realtime サブスクリプション
  useEffect(() => {
    const channel = supabase
      .channel("executive_page_realtime_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_system_state" },
        (payload) => {
          refreshData();
          const row = payload.new as any;
          if (row?.key === "vault_balance") {
            setRealtimeNotice(`【金庫同期】金庫残高が自動更新されました (現在: ¥${Number(row.value?.balance || 0).toLocaleString()})`);
          } else {
            setRealtimeNotice("【システム同期】幹部設定データが自動同期されました！");
          }
          setTimeout(() => setRealtimeNotice(null), 3500);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_action_logs" },
        () => {
          refreshData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sakura_sales" },
        () => {
          refreshData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // --- 従業員管理 state ---
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState<string>(roles[0]?.id || "role-staff");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassInput, setEditPassInput] = useState("");
  const [showPassMap, setShowPassMap] = useState<{ [userId: string]: boolean }>({});

  // --- 役職（ロール）管理 state ---
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("amber");
  const [newRoleIsExec, setNewRoleIsExec] = useState(false);
  const [newRoleBaseAllowance, setNewRoleBaseAllowance] = useState<number>(20000);
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleColor, setEditRoleColor] = useState("amber");
  const [editRoleIsExec, setEditRoleIsExec] = useState(false);
  const [editRoleBaseAllowance, setEditRoleBaseAllowance] = useState<number>(20000);
  const [editRoleDesc, setEditRoleDesc] = useState("");

  // --- 週次（日曜始まり土曜締め）ボーナス査定 & 支給管理 state ---
  const [showBonusHelp, setShowBonusHelp] = useState<boolean>(true);
  const availableWeeks = getRecentWeeks(8);
  // デフォルトは先週（締め済・査定対象週）、なければ今週
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(
    availableWeeks[1]?.weekKey || availableWeeks[0]?.weekKey
  );
  const [weeklyBonusInputs, setWeeklyBonusInputs] = useState<{ [userId: string]: number }>({});
  const [weeklyBonusNotes, setWeeklyBonusNotes] = useState<{ [userId: string]: string }>({});
  const [storeRemainingBonusRate, setStoreRemainingBonusRate] = useState<number>(10); // 店舗残り7割からのボーナス還元率 10%
  const [craftRewardRate, setCraftRewardRate] = useState<number>(100);                 // クラフト仕込み手当 100円/個
  const [baseAllowance, setBaseAllowance] = useState<number>(5000);                   // 基本手当 5,000円
  const [expandedSalesUserId, setExpandedSalesUserId] = useState<string | null>(null);
  const [saveSuccessMap, setSaveSuccessMap] = useState<{ [userId: string]: boolean }>({});

  // --- レシピ編集 state ---
  const [editingRecipeProductId, setEditingRecipeProductId] = useState<string | null>(null);
  const [tempRecipe, setTempRecipe] = useState<RecipeRequirement[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [ingredientQuantity, setIngredientQuantity] = useState<number>(1);
  const [tempPrices, setTempPrices] = useState<{ [itemId: string]: number }>({});

  // --- アイテム 新規登録 state ---
  const [itemType, setItemType] = useState<"product" | "ingredient">("product");
  const [itemShopId, setItemShopId] = useState<ShopId>("sakura");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("料理");
  const [itemPrice, setItemPrice] = useState<number>(1000);
  const [itemInitialStock, setItemInitialStock] = useState<number>(20);
  const [itemUnit, setItemUnit] = useState("個");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [changingImageItemId, setChangingImageItemId] = useState<string | null>(null);

  // --- アイテム 変更（編集） state ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemShopId, setEditItemShopId] = useState<ShopId>("sakura");
  const [editItemName, setEditItemName] = useState("");
  const [editItemType, setEditItemType] = useState<"product" | "ingredient">("product");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemPrice, setEditItemPrice] = useState<number>(1000);
  const [editItemStock, setEditItemStock] = useState<number>(20);
  const [editItemUnit, setEditItemUnit] = useState("個");
  const [editItemImageUrl, setEditItemImageUrl] = useState("");

  // --- 絞り込みフィルター state ---
  const [recipeShopFilter, setRecipeShopFilter] = useState<string>("all");
  const [itemShopFilter, setItemShopFilter] = useState<string>("all");
  const [logFilter, setLogFilter] = useState<string>("all");

  // --- ゲーム内金庫調整 state ---
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultInput, setVaultInput] = useState<number>(vaultBalance);
  const [vaultReason, setVaultReason] = useState<string>("ゲーム内金庫と同期調整");

  const handleOpenVaultModal = () => {
    setVaultInput(vaultBalance);
    setVaultReason("ゲーム内金庫と同期調整");
    setIsVaultModalOpen(true);
  };

  const handleSaveVaultBalance = (e: React.FormEvent) => {
    e.preventDefault();
    updateVaultBalance(vaultInput, vaultReason);
    setIsVaultModalOpen(false);
  };

  // 幹部ガードチェック
  if (!currentUser || currentUser.role !== "executive") {
    return (
      <div className="max-w-xl mx-auto my-12 bg-stone-900/90 rounded-3xl border border-rose-900/50 shadow-2xl p-8 text-center backdrop-blur-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-800/40">
          <Lock className="w-8 h-8" />
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 font-bold border border-rose-800/50 uppercase tracking-wider">
          幹部専用アクセス制限
        </span>
        <h1 className="text-2xl font-black text-white mt-3 mb-2">
          幹部権限が必要です
        </h1>
        <p className="text-xs text-stone-300 max-w-md mx-auto leading-relaxed">
          従業員追加やPASS設定、販売価格・レシピの変更、全操作ログの閲覧は
          「幹部（executive）」権限を持つユーザーのみが行えます。
          （初期管理者: 名前 <strong className="text-amber-300">kein</strong> / PASS <strong className="text-amber-300">001</strong>）
        </p>

        <div className="mt-6 pt-6 border-t border-stone-800 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            メイン画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  // 役職バッジスタイルヘルパー
  const getRoleBadgeClass = (color?: string, isExec?: boolean) => {
    switch (color) {
      case "amber":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "rose":
        return "bg-rose-100 text-rose-900 border-rose-300";
      case "emerald":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "blue":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "purple":
        return "bg-purple-100 text-purple-900 border-purple-300";
      case "stone":
      default:
        return isExec
          ? "bg-amber-100 text-amber-900 border-amber-300"
          : "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  // 1. 従業員登録ハンドラ
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPass.trim()) {
      alert("名前とPASSを入力してください。");
      return;
    }
    // 既存重複チェック
    if (users.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      alert("同じログイン名の従業員が既に存在します。別の名前にしてください。");
      return;
    }

    const selectedRole = roles.find((r) => r.id === newUserRoleId) || roles[0];

    addUser({
      username: newUsername.trim(),
      displayName: newDisplayName.trim() || newUsername.trim(),
      pass: newPass.trim(),
      role: selectedRole.isExecutive ? "executive" : "staff",
      roleId: selectedRole.id,
      roleName: selectedRole.name,
    });

    setNewUsername("");
    setNewDisplayName("");
    setNewPass("");
    alert(`従業員「${newDisplayName.trim() || newUsername.trim()}」を追加しました！`);
  };

  // 役職（ロール）追加ハンドラ
  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert("役職名を入力してください。");
      return;
    }
    addRole({
      name: newRoleName.trim(),
      color: newRoleColor,
      isExecutive: newRoleIsExec,
      baseAllowance: Math.max(0, newRoleBaseAllowance),
      description: newRoleDesc.trim(),
    });
    setNewRoleName("");
    setNewRoleDesc("");
    setNewRoleIsExec(false);
    setNewRoleBaseAllowance(20000);
    alert(`新しい役職「${newRoleName.trim()}」を作成しました！`);
  };

  // 役職編集開始
  const handleStartEditRole = (role: CustomRole) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRoleColor(role.color);
    setEditRoleIsExec(role.isExecutive);
    setEditRoleBaseAllowance(role.baseAllowance ?? 20000);
    setEditRoleDesc(role.description || "");
  };

  // 役職編集保存
  const handleSaveRoleEdit = (roleId: string) => {
    if (!editRoleName.trim()) {
      alert("役職名を入力してください。");
      return;
    }
    updateRole(roleId, {
      name: editRoleName.trim(),
      color: editRoleColor,
      isExecutive: editRoleIsExec,
      baseAllowance: Math.max(0, editRoleBaseAllowance),
      description: editRoleDesc.trim(),
    });
    setEditingRoleId(null);
    alert("役職情報を更新しました！");
  };

  // 役職削除
  const handleDeleteRole = (role: CustomRole) => {
    if (!confirm(`本当に役職「${role.name}」を削除しますか？`)) return;
    const res = deleteRole(role.id);
    alert(res.message);
  };

  // 商品・素材 編集開始
  const handleStartEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditItemShopId(item.shopId || "sakura");
    setEditItemName(item.name);
    setEditItemType(item.type);
    setEditItemCategory(item.category_name || (item.type === "product" ? "料理" : "素材"));
    setEditItemPrice(item.selling_price || 0);
    setEditItemStock(item.current_stock || 0);
    setEditItemUnit(item.unit || "個");
    setEditItemImageUrl(item.image_url || "");
  };

  // 商品・素材 編集保存
  const handleSaveItemEdit = (itemId: string) => {
    if (!editItemName.trim()) {
      alert("品名を入力してください。");
      return;
    }
    updateItem(itemId, {
      name: editItemName.trim(),
      type: editItemType,
      shopId: editItemType === "product" ? editItemShopId : undefined,
      category_name: editItemCategory.trim(),
      selling_price: editItemType === "product" ? Math.max(0, editItemPrice) : 0,
      current_stock: Math.max(0, editItemStock),
      unit: editItemUnit.trim() || "個",
      image_url: editItemImageUrl || undefined,
    });
    setEditingItemId(null);
    alert("品目情報を更新しました！");
  };

  // 商品・素材 削除
  const handleDeleteItem = (item: Item) => {
    if (
      !confirm(
        `本当に「${item.name}」(${item.type === "product" ? "料理商品" : "素材"})を削除しますか？\n※削除すると販売画面や在庫一覧からも完全に削除されます。`
      )
    ) {
      return;
    }
    const res = deleteItem(item.id);
    alert(res.message);
  };

  // 従業員PASS保存
  const handleSavePass = (userId: string) => {
    if (!editPassInput.trim()) {
      alert("PASSを入力してください。");
      return;
    }
    updateUserPass(userId, editPassInput.trim());
    setEditingUserId(null);
    setEditPassInput("");
  };

  // 選択中の週サマリーを取得（日曜始まり土曜締め）
  const currentWeeklySummary = getWeeklySummary(selectedWeekKey);

  // スタッフ別入力値ヘルパー
  const getStaffBonusInput = (userId: string, currentAmount: number) => {
    return weeklyBonusInputs[userId] !== undefined ? weeklyBonusInputs[userId] : currentAmount;
  };

  const getStaffBonusNote = (userId: string, currentNote?: string) => {
    return weeklyBonusNotes[userId] !== undefined ? weeklyBonusNotes[userId] : (currentNote || "");
  };

  // スタッフの役職に応じた基本手当を取得
  const getStaffRoleAllowance = (stat: StaffWeeklyStat): number => {
    const staffRole =
      roles.find((r) => r.id === stat.roleId) ||
      roles.find((r) => r.name === stat.roleName);
    return staffRole?.baseAllowance ?? baseAllowance;
  };

  // 目安ボーナス（自動推奨値）の計算
  // 売上時はゲーム内ですでに3割をインセンティブとして手渡し済み。
  // 店舗手元残り（7割）からの還元率 + クラフト仕込み手当 + ロール別基本手当
  const calculateRecommendedWeeklyBonus = (stat: StaffWeeklyStat) => {
    const storeRemainingShare = Math.round(stat.storeRemaining70 * (storeRemainingBonusRate / 100));
    const craftReward = stat.craftItemsCount * craftRewardRate;
    const roleAllowance = getStaffRoleAllowance(stat);
    return roleAllowance + storeRemainingShare + craftReward;
  };

  // 1人のボーナス保存
  const handleSaveStaffWeeklyBonus = (userId: string) => {
    const stat = currentWeeklySummary.staffStats.find((s) => s.userId === userId);
    if (!stat) return;
    const amount = getStaffBonusInput(userId, stat.bonusAmount);
    const note = getStaffBonusNote(userId, stat.bonusNote);

    saveWeeklyBonus(selectedWeekKey, { [userId]: { amount, note } });
    setSaveSuccessMap((prev) => ({ ...prev, [userId]: true }));
    setTimeout(() => {
      setSaveSuccessMap((prev) => ({ ...prev, [userId]: false }));
    }, 2500);
  };

  // 推奨額を入力欄に反映
  const handleApplyRecommendedToStaff = (stat: StaffWeeklyStat) => {
    const rec = calculateRecommendedWeeklyBonus(stat);
    const allowance = getStaffRoleAllowance(stat);
    setWeeklyBonusInputs((prev) => ({ ...prev, [stat.userId]: rec }));
    setWeeklyBonusNotes((prev) => ({
      ...prev,
      [stat.userId]: `店舗残り7割歩合${storeRemainingBonusRate}%+仕込手当(¥${craftRewardRate}/個)+${stat.roleName || "役職"}手当(¥${allowance.toLocaleString()})`,
    }));
  };

  // 全スタッフに推奨額を一括反映
  const handleApplyAllRecommended = () => {
    const newInputs: { [id: string]: number } = {};
    const newNotes: { [id: string]: string } = {};
    currentWeeklySummary.staffStats.forEach((stat) => {
      const rec = calculateRecommendedWeeklyBonus(stat);
      const allowance = getStaffRoleAllowance(stat);
      newInputs[stat.userId] = rec;
      newNotes[stat.userId] = `店舗残り7割歩合${storeRemainingBonusRate}%+仕込手当(¥${craftRewardRate}/個)+${stat.roleName || "役職"}手当(¥${allowance.toLocaleString()})`;
    });
    setWeeklyBonusInputs((prev) => ({ ...prev, ...newInputs }));
    setWeeklyBonusNotes((prev) => ({ ...prev, ...newNotes }));
    alert("全スタッフに試算推奨ボーナス額を反映しました！内容を調整後、保存または週次確定を行ってください。");
  };

  // 全スタッフの入力を一括保存
  const handleSaveAllStaffBonuses = () => {
    const updates: { [userId: string]: { amount: number; note?: string } } = {};
    currentWeeklySummary.staffStats.forEach((stat) => {
      updates[stat.userId] = {
        amount: getStaffBonusInput(stat.userId, stat.bonusAmount),
        note: getStaffBonusNote(stat.userId, stat.bonusNote),
      };
    });
    saveWeeklyBonus(selectedWeekKey, updates);
    alert("全スタッフのボーナス額を保存しました！");
  };

  // 週次ボーナスの最終確定（店主 kein）
  const handleFinalizeWeek = () => {
    if (
      !confirm(
        `【${currentWeeklySummary.weekLabel}】のボーナス支給額を最終確定しますか？\n確定後は支給決定総額が確定ステータスとして固定され、操作ログに公式記録されます。`
      )
    ) {
      return;
    }
    // 未保存の入力があれば先に保存
    const updates: { [userId: string]: { amount: number; note?: string } } = {};
    currentWeeklySummary.staffStats.forEach((stat) => {
      updates[stat.userId] = {
        amount: getStaffBonusInput(stat.userId, stat.bonusAmount),
        note: getStaffBonusNote(stat.userId, stat.bonusNote),
      };
    });
    saveWeeklyBonus(selectedWeekKey, updates);

    finalizeWeeklyBonus(selectedWeekKey);
    alert(`🎉 ${currentWeeklySummary.weekLabel} のボーナスを最終確定しました！`);
  };

  // 確定解除（再編集）
  const handleUnfinalizeWeek = () => {
    if (
      !confirm(
        `【${currentWeeklySummary.weekLabel}】の確定を解除して再編集可能にしますか？`
      )
    ) {
      return;
    }
    unfinalizeWeeklyBonus(selectedWeekKey);
    alert(`確定を解除しました。金額の再調整が可能です。`);
  };

  // 2. レシピ編集開始
  const handleStartEditRecipe = (product: Item) => {
    setEditingRecipeProductId(product.id);
    setTempRecipe(product.recipe ? [...product.recipe] : []);
    setSelectedIngredientId(ingredients[0]?.id || "");
    setIngredientQuantity(1);
  };

  // レシピに素材を追加
  const handleAddIngredientToRecipe = () => {
    if (!selectedIngredientId) return;
    const ing = ingredients.find((i) => i.id === selectedIngredientId);
    if (!ing) return;

    // 既存に既にあれば数量加算、なければ追加
    const existingIndex = tempRecipe.findIndex((r) => r.ingredient_id === selectedIngredientId);
    if (existingIndex >= 0) {
      const updated = [...tempRecipe];
      updated[existingIndex].quantity += ingredientQuantity;
      setTempRecipe(updated);
    } else {
      setTempRecipe([
        ...tempRecipe,
        {
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          quantity: ingredientQuantity,
          unit: ing.unit,
        },
      ]);
    }
  };

  // レシピから素材を削除
  const handleRemoveIngredientFromRecipe = (index: number) => {
    setTempRecipe(tempRecipe.filter((_, idx) => idx !== index));
  };

  // レシピの保存
  const handleSaveRecipe = (productId: string) => {
    updateRecipe(productId, tempRecipe);
    setEditingRecipeProductId(null);
    alert("クラフトレシピを保存しました！「作成」ボタン時にこの素材が自動消費されます。");
  };

  // 販売価格の即時保存
  const handleSavePrice = (productId: string) => {
    const newPrice = tempPrices[productId];
    if (newPrice === undefined || isNaN(newPrice) || newPrice < 0) {
      alert("有効な金額を入力してください。");
      return;
    }
    updatePrice(productId, newPrice);
    alert(`販売価格を ¥${newPrice.toLocaleString()} に変更しました！`);
  };

  // 3. 新規アイテム登録
  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert("品名を入力してください。");
      return;
    }

    addItem({
      name: itemName.trim(),
      type: itemType,
      shopId: itemType === "product" ? itemShopId : undefined,
      category_name: itemCategory,
      selling_price: itemType === "product" ? itemPrice : 0,
      cost_price: 0,
      current_stock: Math.max(0, itemInitialStock),
      optimal_stock: 50,
      alert_threshold: 5,
      unit: itemUnit.trim() || "個",
      image_url: itemImageUrl || undefined,
      recipe: itemType === "product" ? [] : undefined,
    });

    setItemName("");
    setItemPrice(1000);
    setItemInitialStock(20);
    setItemImageUrl("");
    const shopLabel = itemType === "product" ? (itemShopId === "buon_viaggio" ? "【Buon viaggio】" : "【和食さくら】") : "【共通素材】";
    alert(`${shopLabel}「${itemName}」を新規登録しました！`);
  };

  // 4. ログ絞り込み
  const filteredLogs = actionLogs.filter((log) => {
    if (logFilter === "all") return true;
    return log.category === logFilter;
  });

  // 幹部権限チェック（一般スタッフの場合はアクセス制限画面を表示）
  if (currentUser?.role !== "executive") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center text-white">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-950/30">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black mb-2">幹部専用ページです</h2>
        <p className="text-xs text-stone-400 max-w-sm mb-6 leading-relaxed">
          このページは店主・店長などの幹部権限を持つアカウントのみ閲覧・操作可能です。<br />
          権限が必要な場合は店主（kein）までお問い合わせください。
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-all flex items-center gap-2"
        >
          <span>売上・作成トップ画面に戻る</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-16">
      {/* リアルタイム同期通知 */}
      {realtimeNotice && (
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{realtimeNotice}</span>
        </div>
      )}

      {/* 幹部専用ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-600 via-stone-800 to-stone-900 p-6 rounded-3xl text-white shadow-lg shadow-amber-950/20">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 border-2 border-amber-400/40 p-1 flex items-center justify-center shadow-lg shadow-rose-950/50 shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="和食さくら" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500 text-stone-950">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight">幹部専用 管理コンソール</h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950">
                和食さくら &amp; Buon viaggio
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-1">
              従業員の追加・PASS設定、給与ボーナス査定、料理の販売価格・クラフトレシピ設定、画像アップロード、操作ログ監査
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap justify-end">
          {/* ゲーム内金庫残高ハイライトカード */}
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-stone-900/90 border border-amber-500/40 shadow-md">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 block">ゲーム内金庫残高</span>
              <span className="text-sm sm:text-base font-black text-amber-300">
                {formatCurrency(vaultBalance)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenVaultModal}
              className="ml-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="金庫残高を手動で直接調整する"
            >
              <Edit2 className="w-3 h-3" />
              調整
            </button>
          </div>

          <div className="flex items-center gap-2.5 pl-2 border-l border-stone-800">
            <div className="text-right">
              <span className="text-[10px] text-stone-400 block">ログイン中の幹部</span>
              <span className="text-xs font-black text-amber-300">{currentUser.displayName}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-black text-sm">
              👑
            </div>
          </div>
        </div>
      </div>

      {/* 幹部タブラベル */}
      <div className="flex flex-wrap gap-2 border-b border-stone-800 pb-3">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "users"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <Users className="w-4 h-4 text-amber-500" />
          👥 従業員 &amp; PASS管理 ({users.length}名)
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "roles"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <Tag className="w-4 h-4 text-purple-400" />
          🏷️ 役職（ロール）設定 ({roles.length}種)
        </button>

        <button
          onClick={() => setActiveTab("bonus")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "bonus"
              ? "bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md shadow-amber-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          💰 ボーナス査定 &amp; 支給管理
        </button>

        <button
          onClick={() => setActiveTab("recipes")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "recipes"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          ⚙️ レシピ &amp; 価格設定 ({products.length}商品)
        </button>

        <button
          onClick={() => setActiveTab("items")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "items"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <ImageIcon className="w-4 h-4 text-amber-400" />
          🍱 商品・素材登録 &amp; 変更 ({items.length}品目)
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "logs"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30 scale-[1.02]"
              : "bg-stone-900/90 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
          }`}
        >
          <History className="w-4 h-4 text-amber-400" />
          📜 店舗操作ログ監査 ({actionLogs.length}件)
        </button>
      </div>

      {/* ========================================================
          タブ1: 👥 従業員 & PASS管理
      ======================================================== */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: 従業員新規追加フォーム */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl h-fit text-stone-100">
            <h2 className="text-sm font-black text-white flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-amber-500" />
              従業員の新規追加
            </h2>
            <p className="text-xs text-stone-400 mb-4">
              名前・ログインPASS・役職（ロール）を設定して従業員を登録します
            </p>

            <form onSubmit={handleAddUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  ログイン名 (英数字・小文字):
                </label>
                <input
                  type="text"
                  placeholder="例: taro, sora, ken"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-white placeholder:text-stone-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  店舗表示名 (名前):
                </label>
                <input
                  type="text"
                  placeholder="例: 太郎 (寿司職人)"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-white placeholder:text-stone-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  ログインPASS:
                </label>
                <input
                  type="text"
                  placeholder="例: 1234, 002"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs focus:ring-2 focus:ring-amber-500 font-mono font-bold text-white placeholder:text-stone-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  役職（ロール）の割り当て:
                </label>
                <select
                  value={newUserRoleId}
                  onChange={(e) => setNewUserRoleId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-bold text-white focus:ring-2 focus:ring-amber-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} className="bg-stone-900 text-white">
                      {r.name} {r.isExecutive ? "(幹部権限あり)" : "(一般スタッフ)"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-400 mt-1">
                  ※役職の種類・色・幹部権限は「🏷️ 役職（ロール）設定」タブで自由に追加・編集できます
                </p>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                従業員を追加登録する
              </button>
            </form>
          </div>

          {/* 右側: 従業員一覧 & PASS・役職編集リスト */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                登録済み従業員一覧 ({users.length}名)
              </h2>
              <span className="text-[11px] text-stone-400">
                管理者 <strong className="text-amber-300 font-bold">kein (PASS: 001)</strong> は保護されています
              </span>
            </div>

            <div className="space-y-3">
              {users.map((u) => {
                const isKein = u.username.toLowerCase() === "kein";
                const isEditing = editingUserId === u.id;
                const isShowPass = showPassMap[u.id] || false;
                const userRoleObj = roles.find((r) => r.id === u.roleId);
                const badgeColor = userRoleObj?.color || (u.role === "executive" ? "amber" : "stone");

                return (
                  <div
                    key={u.id}
                    className={`bg-stone-900/90 p-4 rounded-2xl border transition-all shadow-md ${
                      isKein ? "border-amber-500/50 bg-stone-900" : "border-stone-800"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* ユーザー情報 */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                            u.role === "executive"
                              ? "bg-amber-950 text-amber-400 border border-amber-600/40"
                              : "bg-stone-800 text-stone-300 border border-stone-700"
                          }`}
                        >
                          {u.role === "executive" ? "👑" : "👤"}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{u.displayName}</span>
                            {/* カスタム役職バッジ */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getRoleBadgeClass(
                                badgeColor,
                                u.role === "executive"
                              )}`}
                            >
                              {u.roleName || userRoleObj?.name || (u.role === "executive" ? "幹部" : "スタッフ")}
                            </span>
                            {u.role === "executive" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400 border border-amber-500/30">
                                幹部権限
                              </span>
                            )}
                            {isKein && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold">
                                店主 (最高管理者)
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-400 font-mono">
                            ID: @{u.username}
                          </span>
                        </div>
                      </div>

                      {/* PASS表示 & 役職変更 UI */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
                          <Key className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-[11px] text-stone-400 font-semibold">PASS:</span>
                          <span className="text-xs font-mono font-black text-amber-300 tracking-wider">
                            {isShowPass ? u.pass : "••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowPassMap((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                            }
                            className="text-stone-400 hover:text-white p-0.5 cursor-pointer"
                            title={isShowPass ? "隠す" : "表示する"}
                          >
                            {isShowPass ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* PASS編集ボタン */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(u.id);
                            setEditPassInput(u.pass);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors cursor-pointer"
                        >
                          PASS変更
                        </button>

                        {/* 役職（ロール）変更ドロップダウン */}
                        {!isKein ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-stone-400 font-bold">役職:</span>
                            <select
                              value={u.roleId || (u.role === "executive" ? "role-manager" : "role-staff")}
                              onChange={(e) => updateUserCustomRole(u.id, e.target.value)}
                              className="px-2 py-1.5 rounded-xl text-xs font-bold bg-stone-950 border border-stone-700 text-stone-200 hover:border-amber-500 transition-colors cursor-pointer"
                              title="役職を変更する"
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.id} className="bg-stone-900 text-white">
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-400 px-2.5 py-1 bg-amber-950/60 rounded-xl border border-amber-500/40">
                            役職固定 (店主)
                          </span>
                        )}

                        {/* 削除ボタン (keinは削除不可) */}
                        {!isKein && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`本当に「${u.displayName}」を削除しますか？`)) {
                                deleteUser(u.id);
                              }
                            }}
                            className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800 transition-colors ml-1 cursor-pointer"
                            title="従業員を削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* インライン PASS 編集フォーム */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-300 shrink-0">新しいPASS:</span>
                        <input
                          type="text"
                          value={editPassInput}
                          onChange={(e) => setEditPassInput(e.target.value)}
                          className="px-3 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-mono font-bold w-36 text-white focus:border-amber-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePass(u.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs cursor-pointer"
                        >
                          キャンセル
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          タブ: 🏷️ 役職（ロール）設定
      ======================================================== */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: 新規役職の作成フォーム */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl h-fit space-y-4 text-stone-100">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                新しい役職（ロール）を作成
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                店主、店長、料理長、ホール主任など、お店独自の役職を自由に命名・設定できます
              </p>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  役職名:
                </label>
                <input
                  type="text"
                  placeholder="例: 副店長、板長、ホールリーダー、見習い"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-bold text-white placeholder:text-stone-600 focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* カラー選択 */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  バッジカラー:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "amber", label: "琥珀/金", bg: "bg-amber-950 text-amber-300 border-amber-700" },
                    { id: "rose", label: "桜/赤", bg: "bg-rose-950 text-rose-300 border-rose-700" },
                    { id: "emerald", label: "翡翠/緑", bg: "bg-emerald-950 text-emerald-300 border-emerald-700" },
                    { id: "blue", label: "藍/青", bg: "bg-blue-950 text-blue-300 border-blue-700" },
                    { id: "purple", label: "紫", bg: "bg-purple-950 text-purple-300 border-purple-700" },
                    { id: "stone", label: "墨/灰", bg: "bg-stone-800 text-stone-300 border-stone-600" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewRoleColor(c.id)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${c.bg} ${
                        newRoleColor === c.id ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-stone-900 scale-105" : "opacity-75 hover:opacity-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 幹部画面アクセス権限チェック */}
              <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-500/30">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRoleIsExec}
                    onChange={(e) => setNewRoleIsExec(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-500 w-4 h-4 bg-stone-950 border-stone-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">
                      幹部専用コンソールへのアクセスを許可する
                    </span>
                    <span className="text-[11px] text-stone-400">
                      ONにすると、この役職のスタッフは従業員管理や価格設定などの幹部画面に入れます。
                    </span>
                  </div>
                </label>
              </div>

              {/* 週次基本手当入力 */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  週次基本手当 (円):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-500 font-bold text-xs">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="20000"
                    value={newRoleBaseAllowance}
                    onChange={(e) => setNewRoleBaseAllowance(parseInt(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-bold text-white focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  この役職のスタッフに毎週支給する基礎手当額（ボーナス試算時に自動反映）
                </span>
              </div>

              {/* 説明・備考メモ */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  説明・職務メモ (任意):
                </label>
                <input
                  type="text"
                  placeholder="例: 店舗運営全般、仕込みと在庫管理など"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white placeholder:text-stone-600 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                役職を作成する
              </button>
            </form>
          </div>

          {/* 右側: 登録済み役職一覧 */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  設定済み役職（ロール）一覧 ({roles.length}種)
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  役職名や権限の変更、不要な役職の削除を行えます
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {roles.map((role) => {
                const isEditing = editingRoleId === role.id;
                const assignedUsers = users.filter((u) => u.roleId === role.id);

                return (
                  <div
                    key={role.id}
                    className="bg-stone-900/90 p-4 rounded-2xl border border-stone-800 shadow-md space-y-3 text-stone-100"
                  >
                    {!isEditing ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-black border ${getRoleBadgeClass(
                              role.color,
                              role.isExecutive
                            )}`}
                          >
                            {role.name}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              {role.isExecutive ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/40">
                                  👑 幹部権限あり
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                                  一般スタッフ権限
                                </span>
                              )}
                              <span className="text-[11px] text-stone-400 font-bold">
                                所属: {assignedUsers.length}名
                              </span>
                              <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                                💰 週次基本手当: ¥{(role.baseAllowance ?? 20000).toLocaleString()}
                              </span>
                            </div>
                            {role.description && (
                              <p className="text-xs text-stone-400 mt-1">{role.description}</p>
                            )}
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditRole(role)}
                            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" /> 変更
                          </button>
                          {!role.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(role)}
                              className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800 transition-colors cursor-pointer"
                              title="役職を削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 役職のインライン編集フォーム */
                      <div className="p-4 bg-purple-950/40 rounded-xl border border-purple-500/40 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-stone-300 mb-1">役職名:</label>
                            <input
                              type="text"
                              value={editRoleName}
                              onChange={(e) => setEditRoleName(e.target.value)}
                              className="w-full px-3 py-1.5 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-300 mb-1">バッジカラー:</label>
                            <select
                              value={editRoleColor}
                              onChange={(e) => setEditRoleColor(e.target.value)}
                              className="w-full px-3 py-1.5 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-purple-500"
                            >
                              <option value="amber">琥珀/金 (amber)</option>
                              <option value="rose">桜/赤 (rose)</option>
                              <option value="emerald">翡翠/緑 (emerald)</option>
                              <option value="blue">藍/青 (blue)</option>
                              <option value="purple">紫 (purple)</option>
                              <option value="stone">墨/灰 (stone)</option>
                            </select>
                          </div>
                        </div>

                        {/* 週次基本手当の編集 */}
                        <div>
                          <label className="block text-xs font-bold text-stone-300 mb-1">
                            週次基本手当 (円):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={editRoleBaseAllowance}
                            onChange={(e) => setEditRoleBaseAllowance(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRoleIsExec}
                              onChange={(e) => setEditRoleIsExec(e.target.checked)}
                              className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4 bg-stone-950 border-stone-700"
                            />
                            <span className="text-xs font-bold text-amber-300">
                              幹部専用コンソールへのアクセスを許可する
                            </span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-300 mb-1">説明・職務メモ:</label>
                          <input
                            type="text"
                            value={editRoleDesc}
                            onChange={(e) => setEditRoleDesc(e.target.value)}
                            className="w-full px-3 py-1.5 bg-stone-950 rounded-lg border border-stone-700 text-xs text-white"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingRoleId(null)}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRoleEdit(role.id)}
                            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> 変更を保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          タブ: 💰 ボーナス査定 & 支給管理（週次 日曜〜土曜締め）
      ======================================================== */}
      {activeTab === "bonus" && (
        <div className="space-y-6">
          {/* 💡 ボーナスの出し方・査定ルール解説パネル（折りたたみ可能） */}
          <div className="bg-gradient-to-r from-amber-950/60 via-stone-900 to-stone-950 rounded-3xl border border-amber-500/40 p-5 shadow-xl text-stone-100">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowBonusHelp(!showBonusHelp)}
            >
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calculator className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    💡 【和食さくら】ボーナス査定・出し方のルール解説
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      店主必読マニュアル
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    日々の即時手渡し3割 ＋ 週締め時のボーナス（役職手当＋7割歩合＋仕込み手当）の算出基準
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-amber-400 font-bold hover:text-amber-300 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 cursor-pointer"
              >
                {showBonusHelp ? "折りたたむ ▲" : "仕組みを見る ▼"}
              </button>
            </div>

            {showBonusHelp && (
              <div className="mt-4 pt-4 border-t border-stone-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[11px] text-amber-300 font-black">1</span>
                    日々の即時インセンティブ（3割）
                  </div>
                  <p className="text-[11px] text-stone-300 leading-relaxed">
                    レジで料理・商品（1品10,000円等）が売れた際、売上金額の<strong className="text-amber-300">30%（3割）</strong>はその場でスタッフが受取済みの即時インセンティブです。残りの<strong className="text-emerald-300">70%</strong>が店舗の金庫に入金されます。
                  </p>
                </div>

                <div className="bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                    <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-[11px] text-rose-300 font-black">2</span>
                    週次ボーナス試算（3大構成要素）
                  </div>
                  <p className="text-[11px] text-stone-300 leading-relaxed">
                    毎週日曜〜土曜締めで査定するボーナスは、<strong className="text-white">①ロール別基本手当</strong>（役職ごとの固定給）＋<strong className="text-white">②店舗残り7割からの歩合</strong>（例: 10%）＋<strong className="text-white">③クラフト仕込み手当</strong>（例: ¥100/個）の合計で推奨額が自動試算されます。
                  </p>
                </div>

                <div className="bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px] text-emerald-300 font-black">3</span>
                    確定・支給 ＆ 未払い繰越管理
                  </div>
                  <p className="text-[11px] text-stone-300 leading-relaxed">
                    査定額が決まったら「最終確定」し、現金を渡したら「支払済」にチェック。支払えなかった分は<strong className="text-amber-300">翌週以降へ「過去未払い繰越」として自動合算</strong>されるため、給与の未払い・支払漏れを完全に防止できます。
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ① 週選択バー & 確定ステータス */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 text-white p-5 rounded-3xl shadow-md border border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-stone-400 block">
                    集計対象週（日曜00:00 〜 土曜23:59 締め）
                  </span>
                  {currentWeeklySummary.isFinalized ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                      <CheckCheck className="w-3 h-3" />
                      確定済み
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50">
                      <FileText className="w-3 h-3" />
                      未確定（査定中）
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedWeekKey}
                    onChange={(e) => setSelectedWeekKey(e.target.value)}
                    className="bg-stone-800 hover:bg-stone-750 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-stone-700 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {availableWeeks.map((w, idx) => (
                      <option key={w.weekKey} value={w.weekKey}>
                        {w.weekLabel} {idx === 0 ? "（今週・集計中）" : idx === 1 ? "（先週・締め済）" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 確定アクションボタン */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {currentWeeklySummary.isFinalized ? (
                <div className="flex items-center gap-3">
                  <div className="text-right text-[11px] text-stone-300 hidden md:block">
                    <div>確定者: <strong className="text-white">{currentWeeklySummary.finalizedBy}</strong></div>
                    <div className="text-[10px] text-stone-400">
                      {currentWeeklySummary.finalizedAt &&
                        new Date(currentWeeklySummary.finalizedAt).toLocaleString("ja-JP", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnfinalizeWeek}
                    className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-bold border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    確定を解除して再編集
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalizeWeek}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-black shadow-lg shadow-amber-950/40 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  この週のボーナスを最終確定する
                </button>
              )}
            </div>
          </div>

          {/* ② 【店舗別 & 2店舗合計 実績サマリーカード】 */}
          <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 shadow-xl space-y-5 text-stone-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <TrendingUp className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">
                    【各店舗別 &amp; 2店舗合計】{currentWeeklySummary.weekLabel} 実績サマリー
                  </h3>
                  <p className="text-xs text-stone-400">
                    和食さくら・Buon viaggio 各店舗ごとの売上と手渡し・手元純利益、および全体合計
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-stone-300 bg-stone-800 border border-stone-700 px-3 py-1 rounded-xl">
                在籍スタッフ: {currentWeeklySummary.staffStats.length}名
              </span>
            </div>

            {/* 店舗別 実績内訳カード（3カラム: 🌸 和食さくら / 🍷 Buon viaggio / 🏛️ 2店舗合計） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 🌸 和食さくら */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-rose-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-950/60 pb-2">
                  <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-rose-500" />
                    🌸 和食さくら 実績
                  </span>
                  <span className="text-[10px] text-stone-400">料理販売: {currentWeeklySummary.sakura.itemsSold}品</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">売上高 (100%):</span>
                    <span className="text-base font-black text-white">{formatCurrency(currentWeeklySummary.sakura.salesAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">手渡済インセンティブ (3割):</span>
                    <span className="font-bold text-amber-300">{formatCurrency(currentWeeklySummary.sakura.incentive30)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400">店舗手元純残り (7割):</span>
                    <span className="font-bold text-emerald-300">{formatCurrency(currentWeeklySummary.sakura.storeRemaining70)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
                    <span className="text-stone-400">厨房仕込み数:</span>
                    <span className="font-bold text-stone-200">{currentWeeklySummary.sakura.craftItemsCount} 個</span>
                  </div>
                </div>
              </div>

              {/* 🍷 Buon viaggio */}
              <div className="p-4 rounded-2xl bg-stone-950 border border-purple-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-950/60 pb-2">
                  <span className="text-xs font-black text-purple-400 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-purple-400" />
                    🍷 Buon viaggio 実績
                  </span>
                  <span className="text-[10px] text-stone-400">料理販売: {currentWeeklySummary.buonViaggio.itemsSold}品</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">売上高 (100%):</span>
                    <span className="text-base font-black text-white">{formatCurrency(currentWeeklySummary.buonViaggio.salesAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">手渡済インセンティブ (3割):</span>
                    <span className="font-bold text-amber-300">{formatCurrency(currentWeeklySummary.buonViaggio.incentive30)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400">店舗手元純残り (7割):</span>
                    <span className="font-bold text-emerald-300">{formatCurrency(currentWeeklySummary.buonViaggio.storeRemaining70)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
                    <span className="text-stone-400">厨房仕込み数:</span>
                    <span className="font-bold text-stone-200">{currentWeeklySummary.buonViaggio.craftItemsCount} 個</span>
                  </div>
                </div>
              </div>

              {/* 🏛️ 2店舗 総合計 */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/30 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    🏛️ 2店舗 総合計
                  </span>
                  <span className="text-[10px] text-amber-300/80 font-bold">全体サマリー</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-300 font-bold">総売上 (100%):</span>
                    <span className="text-base font-black text-amber-300">{formatCurrency(currentWeeklySummary.totalSales)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">手渡総額 (3割):</span>
                    <span className="font-bold text-amber-300">{formatCurrency(currentWeeklySummary.totalIncentive30)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400">店舗純残り総額 (7割):</span>
                    <span className="font-bold text-emerald-300">{formatCurrency(currentWeeklySummary.totalStoreRemaining70)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
                    <span className="text-stone-300">厨房総仕込み数:</span>
                    <span className="font-bold text-indigo-300">{currentWeeklySummary.totalCraftItems} 個</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 🏛️ 【ゲーム内金庫 ＆ ボーナス支給・過去未払い合算サマリー】 */}
            <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      ゲーム内金庫残高 ＆ ボーナス支払資金シミュレーション
                    </h4>
                    <p className="text-[10px] text-stone-400">
                      売上発生で自動入金され、ボーナス支払時（支払済✅）に自動出金されます。手動での直接調整も可能です
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenVaultModal}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  金庫残高を手動調整
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* ① 現在のゲーム内金庫残高 */}
                <div className="p-3.5 rounded-xl bg-stone-900 border border-amber-500/40 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">🏛️ ゲーム内金庫残高:</span>
                    <span className="text-[10px] font-bold text-amber-300/80 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.2 rounded">
                      現在資金
                    </span>
                  </div>
                  <span className="text-2xl font-black text-amber-300 block mt-1">
                    {formatCurrency(vaultBalance)}
                  </span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    店舗の全手元残高
                  </span>
                </div>

                {/* ② 今週の決定ボーナス総額 */}
                <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-300">今週の決定ボーナス:</span>
                    <span className="text-[10px] text-stone-400">
                      {currentWeeklySummary.isFinalized ? "✅ 確定済" : "📝 査定中"}
                    </span>
                  </div>
                  <span className="text-xl font-black text-rose-400 block mt-1">
                    {formatCurrency(currentWeeklySummary.totalBonusPayout)}
                  </span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    スタッフ{currentWeeklySummary.staffStats.length}名分
                  </span>
                </div>

                {/* ③ 手渡し未払い残高 (残り支払うべき総額) */}
                <div className="p-3.5 rounded-xl bg-stone-900 border border-amber-500/40 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300">手渡し未払い残高 (残り支払額):</span>
                    {currentWeeklySummary.totalRemainingDuePayout > 0 ? (
                      <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.2 rounded animate-pulse">
                        要手渡し
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded">
                        全額支給済 ✨
                      </span>
                    )}
                  </div>
                  <span className={`text-xl font-black block mt-1 ${currentWeeklySummary.totalRemainingDuePayout > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {formatCurrency(currentWeeklySummary.totalRemainingDuePayout)}
                  </span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    決定総枠: {formatCurrency(currentWeeklySummary.totalDuePayout)}
                    {currentWeeklySummary.totalUnpaidCarryover > 0 && ` (過去未払繰越 +${formatCurrency(currentWeeklySummary.totalUnpaidCarryover)} 含む)`}
                  </span>
                </div>

                {/* ④ 全残額支払後の予想金庫残高 */}
                {(() => {
                  const projectedBalance = vaultBalance - currentWeeklySummary.totalRemainingDuePayout;
                  const isSafe = projectedBalance >= 0;
                  return (
                    <div className={`p-3.5 rounded-xl border shadow-sm ${
                      isSafe
                        ? "bg-emerald-950/20 border-emerald-500/40"
                        : "bg-rose-950/30 border-rose-500/50"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${isSafe ? "text-emerald-300" : "text-rose-300"}`}>
                          📉 残額支払後 予想金庫残高:
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                          isSafe ? "bg-emerald-900/60 text-emerald-300" : "bg-rose-900/60 text-rose-300"
                        }`}>
                          {isSafe ? "余力あり" : "残高不足"}
                        </span>
                      </div>
                      <span className={`text-2xl font-black block mt-1 ${
                        isSafe ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {formatCurrency(projectedBalance)}
                      </span>
                      <span className={`text-[10px] block mt-0.5 ${isSafe ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                        {isSafe ? "✅ 金庫資金で十分支給可能" : "⚠️ 金庫残高を超過しています"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ③ 【査定補助シミュレーター】（試算目安＆一括反映） */}
          <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-5 shadow-xl space-y-3 text-stone-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  ボーナス試算アシスト（店主の査定目安設定）
                </span>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  店舗手元残り（7割）からの歩合還元率や仕込み手当を設定し、ワンクリックで推奨金額を各スタッフの入力欄にセットできます
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAllRecommended}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  全スタッフに試算推奨額を一括反映
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllStaffBonuses}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-900/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  全員分を一括保存
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  ① 店舗残り7割からの歩合率 (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={storeRemainingBonusRate}
                    onChange={(e) => setStoreRemainingBonusRate(parseInt(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1.5 bg-stone-900 rounded-xl border border-stone-700 font-black text-white focus:border-amber-500"
                  />
                  <span className="text-stone-400 font-semibold">%（手元純利益から還元）</span>
                </div>
              </div>

              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  ② クラフト仕込み手当 (円/個):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={craftRewardRate}
                    onChange={(e) => setCraftRewardRate(parseInt(e.target.value) || 0)}
                    className="w-24 px-2.5 py-1.5 bg-stone-900 rounded-xl border border-stone-700 font-black text-white focus:border-amber-500"
                  />
                  <span className="text-stone-400 font-semibold">円（料理1品仕込む毎）</span>
                </div>
              </div>

              <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  ③ 役職未設定時の標準基本手当:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={baseAllowance}
                    onChange={(e) => setBaseAllowance(parseInt(e.target.value) || 0)}
                    className="w-28 px-2.5 py-1.5 bg-stone-900 rounded-xl border border-stone-700 font-black text-white focus:border-amber-500"
                  />
                  <span className="text-stone-400 font-semibold">円（共通フォールバック）</span>
                </div>
              </div>
            </div>

            {/* ロール別基本手当の一覧 ＆ クイック変更バー */}
            <div className="p-3.5 bg-stone-950/80 rounded-2xl border border-stone-800 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  現在の役職（ロール）別 基本手当一覧（数値を直接変更して即座に反映可能）:
                </span>
                <span className="text-[10px] text-stone-500">
                  ※変更した手当額は役職設定に即座に自動保存されます
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 rounded-xl bg-stone-900 border border-stone-800 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-stone-200 truncate" title={r.name}>
                        {r.name}
                      </span>
                      {r.isExecutive && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0">
                          幹部
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-500 font-bold">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={r.baseAllowance ?? 20000}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateRole(r.id, { baseAllowance: val });
                        }}
                        className="w-full px-2 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-black text-amber-300 focus:border-amber-500"
                        title="手当額を直接変更"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ④ 【人別（スタッフ別）実績 ＆ 週次ボーナス決定一覧 (売上順)】 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                【売上ランキング順】スタッフ別実績 &amp; 週次ボーナス決定 ({currentWeeklySummary.staffStats.length}名)
              </h3>
              <span className="text-[11px] font-bold text-stone-400 bg-stone-950 border border-stone-800 px-2.5 py-1 rounded-lg">
                売上実績が高い順に並び替え中
              </span>
            </div>

            {[...currentWeeklySummary.staffStats]
              .sort((a, b) => {
                if (b.salesAmount !== a.salesAmount) {
                  return b.salesAmount - a.salesAmount; // 売上高 降順
                }
                return b.craftItemsCount - a.craftItemsCount; // 売上が同じならクラフト作成数 降順
              })
              .map((stat, rankIdx) => {
                const recommended = calculateRecommendedWeeklyBonus(stat);
                const currentInput = getStaffBonusInput(stat.userId, stat.bonusAmount);
                const currentNote = getStaffBonusNote(stat.userId, stat.bonusNote);
                const isSaved = saveSuccessMap[stat.userId] || false;
                const isExpandedSales = expandedSalesUserId === stat.userId;
                const hasPastUnpaid = stat.previousUnpaidBonusTotal > 0;

                return (
                  <div
                    key={stat.userId}
                    className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 shadow-xl transition-all space-y-4 text-stone-100"
                  >
                    {/* スタッフ概要ヘッダー */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                            stat.role === "executive"
                              ? "bg-amber-950 text-amber-400 border border-amber-600/40"
                              : "bg-stone-800 text-stone-300 border border-stone-700"
                          }`}
                        >
                          {stat.role === "executive" ? "👑" : "👤"}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 売上順位バッジ */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                rankIdx === 0
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                                  : rankIdx === 1
                                  ? "bg-stone-300/20 text-stone-200 border-stone-400/40"
                                  : rankIdx === 2
                                  ? "bg-amber-800/20 text-amber-400 border-amber-800/40"
                                  : "bg-stone-800 text-stone-400 border-stone-700"
                              }`}
                            >
                              {rankIdx === 0
                                ? "🥇 売上1位"
                                : rankIdx === 1
                                ? "🥈 売上2位"
                                : rankIdx === 2
                                ? "🥉 売上3位"
                                : `売上${rankIdx + 1}位`}
                            </span>

                            <h3 className="font-extrabold text-base text-white">
                              {stat.displayName}
                            </h3>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                stat.role === "executive"
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-600/40"
                                  : "bg-stone-800 text-stone-300 border border-stone-700"
                              }`}
                            >
                              {stat.role === "executive" ? "幹部" : "スタッフ"}
                            </span>
                            <span className="text-xs text-stone-400 font-mono">@{stat.username}</span>

                            {/* 支払いステータス特大バッジ（パッと見で支払済か未払いか分かる！） */}
                            {stat.remainingDueAmount === 0 ? (
                              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 flex items-center gap-1 shadow-xs">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                ✨ 全額支給完了
                              </span>
                            ) : (
                              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/70 text-amber-300 flex items-center gap-1 shadow-xs animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                ⏳ 未払いあり (残: {formatCurrency(stat.remainingDueAmount)})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            対象期間: {currentWeeklySummary.weekLabel}
                          </p>
                        </div>
                      </div>

                    {/* 右側: 【残りの金額】と【今週の金額】を明確に表示 & 支払状況切り替え */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* ① 今週の決定金額 & 今週分支払いボタン */}
                      <div className="bg-stone-950 border border-stone-800 p-3 rounded-2xl flex flex-col justify-between min-w-[170px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-stone-400">💴 今週の決定額:</span>
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                            stat.isPaid ? "bg-emerald-950 text-emerald-400 border border-emerald-600/40" : "bg-amber-950 text-amber-300 border border-amber-600/40"
                          }`}>
                            {stat.isPaid ? "今週分済" : "今週未払"}
                          </span>
                        </div>
                        <div className="text-xl font-black text-white mb-2">
                          {formatCurrency(stat.bonusAmount)}
                        </div>

                        {/* 今週分の支払切替トグルボタン */}
                        <button
                          type="button"
                          onClick={() => toggleBonusPaid(selectedWeekKey, stat.userId, !stat.isPaid)}
                          className={`w-full px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                            stat.isPaid
                              ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/80"
                              : "bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold hover:shadow-md hover:scale-[1.01]"
                          }`}
                          title={stat.isPaid ? "クリックすると今週分を未払いに戻します" : "クリックすると今週分を支払済みにします（残り金額が即座に減ります）"}
                        >
                          {stat.isPaid ? (
                            <>
                              <CheckCheck className="w-4 h-4 text-emerald-400" />
                              <span>今週分: 支払済 ✅ (取消)</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4" />
                              <span>今週分を【支払済】にする</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* ② スタッフへ手渡す【残り金額】（未払いを支払い済みにすると即座に減る！） */}
                      <div className={`p-3 rounded-2xl border shadow-sm flex flex-col justify-between min-w-[200px] ${
                        stat.remainingDueAmount === 0
                          ? "bg-emerald-950/20 border-emerald-500/50"
                          : "bg-stone-950 border-amber-500/60 ring-1 ring-amber-500/30"
                      }`}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={`font-black flex items-center gap-1 ${
                            stat.remainingDueAmount === 0 ? "text-emerald-400" : "text-amber-400"
                          }`}>
                            <Coins className="w-3.5 h-3.5" />
                            手渡す【残り金額】:
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            stat.remainingDueAmount === 0
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-amber-900/80 text-amber-200 animate-pulse"
                          }`}>
                            {stat.remainingDueAmount === 0 ? "精算完了" : "要手渡し"}
                          </span>
                        </div>

                        {/* 残り金額の特大表示 */}
                        <div className={`text-2xl font-black ${
                          stat.remainingDueAmount === 0 ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {stat.remainingDueAmount === 0 ? "¥0 (支給完了 ✨)" : formatCurrency(stat.remainingDueAmount)}
                        </div>

                        {/* 内訳情報 */}
                        <div className="text-[10px] mt-1 text-stone-400">
                          {stat.remainingDueAmount === 0 ? (
                            <span className="text-emerald-400/90 font-bold">手渡し残額はありません</span>
                          ) : (
                            <span>
                              内訳: 今週未払 {formatCurrency(stat.thisWeekUnpaidAmount)}
                              {hasPastUnpaid && ` ＋ 過去未払 ${formatCurrency(stat.previousUnpaidBonusTotal)}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 過去の確定済み未払いボーナスがある場合の合算警告 & 一括精算 */}
                  {hasPastUnpaid ? (
                    <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">
                              過去の確定済み週に未払いが【{stat.previousUnpaidWeeks.length}週分】あります (合算額: +{formatCurrency(stat.previousUnpaidBonusTotal)})
                            </span>
                            <span className="text-[10px] text-amber-400/80">
                              ※精算すると「スタッフへ手渡す残り金額」から即座に差し引かれます
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `「${stat.displayName}」の過去の未払いボーナス（計 ${formatCurrency(
                                  stat.previousUnpaidBonusTotal
                                )}）を一括で【支払済】に精算しますか？\n※スタッフへ手渡す残り金額から即座に差し引かれます。`
                              )
                            ) {
                              markAllPastBonusesAsPaid(stat.userId);
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors self-start sm:self-auto cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCheck className="w-4 h-4" />
                          <span>過去の未払いを一括で支払済みにする</span>
                        </button>
                      </div>

                      {/* 未払い週の詳細リスト */}
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-900/40">
                        <span className="text-[10px] text-amber-400 font-bold">未払い週内訳:</span>
                        {stat.previousUnpaidWeeks.map((w) => (
                          <span
                            key={w.weekKey}
                            className="px-2 py-0.5 rounded-md bg-stone-950 border border-amber-500/30 text-[10px] text-amber-200"
                          >
                            {w.weekLabel}: <strong>{formatCurrency(w.amount)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-[11px] text-stone-400 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>過去の確定済みボーナスはすべて精算完了しています (未払い繰越なし)</span>
                    </div>
                  )}

                  {/* 店舗別 売上貢献の内訳（🌸 さくら / 🍷 Buon viaggio） */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-950 p-3.5 rounded-2xl border border-stone-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <span>🌸</span> 和食さくら売上:
                      </span>
                      <span className="text-white font-black text-sm">
                        {formatCurrency(stat.sakuraSalesAmount)}{" "}
                        <span className="text-[10px] text-stone-400 font-normal">({stat.sakuraItemsSold}品)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:border-l sm:border-stone-800 sm:pl-3">
                      <span className="text-purple-400 font-bold flex items-center gap-1">
                        <span>🍷</span> Buon viaggio売上:
                      </span>
                      <span className="text-white font-black text-sm">
                        {formatCurrency(stat.buonViaggioSalesAmount)}{" "}
                        <span className="text-[10px] text-stone-400 font-normal">({stat.buonViaggioItemsSold}品)</span>
                      </span>
                    </div>
                  </div>

                  {/* 人別 4大実績指標（売上・3割手渡し・7割店舗残り・クラフト数） */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-black text-stone-300 mb-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      この週の活動実績（査定の判断材料）
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* ① 総売上 (100%) */}
                      <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                        <span className="text-[11px] font-bold text-stone-400 block">
                          ① 売上貢献計 (100%)
                        </span>
                        <span className="text-lg font-black text-white block mt-1">
                          {formatCurrency(stat.salesAmount)}
                        </span>
                        <span className="text-[10px] text-stone-400 mt-0.5 block">
                          伝票: {stat.salesCount}件 / 料理 {stat.itemsSold}個
                        </span>
                      </div>

                      {/* ② 手渡しインセンティブ (3割 / 30%) */}
                      <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30">
                        <span className="text-[11px] font-bold text-amber-400 block">
                          ② 手渡し済 (3割)
                        </span>
                        <span className="text-lg font-black text-amber-300 block mt-1">
                          {formatCurrency(stat.incentive30)}
                        </span>
                        <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                          販売時スタッフ受取済
                        </span>
                      </div>

                      {/* ③ 店舗手元残り (7割 / 70%) */}
                      <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                        <span className="text-[11px] font-bold text-emerald-400 block">
                          ③ 店舗純手元残り (7割)
                        </span>
                        <span className="text-lg font-black text-emerald-300 block mt-1">
                          {formatCurrency(stat.storeRemaining70)}
                        </span>
                        <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                          店舗側の純利益
                        </span>
                      </div>

                      {/* ④ クラフト数 & 在庫調整 */}
                      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30">
                        <span className="text-[11px] font-bold text-indigo-400 block">
                          ④ 厨房仕込み (クラフト数)
                        </span>
                        <span className="text-lg font-black text-indigo-300 block mt-1">
                          {stat.craftItemsCount} <span className="text-xs font-bold text-indigo-400">個</span>
                        </span>
                        <span className="text-[10px] text-indigo-400/80 mt-0.5 block">
                          作成: {stat.craftCount}回 / 調整: {stat.inventoryAdjustCount}回
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 店主によるボーナス金額決定・メモ入力フォーム */}
                  <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-stone-300">
                            今週の支給ボーナス決定額 (¥):
                          </label>
                          <button
                            type="button"
                            onClick={() => handleApplyRecommendedToStaff(stat)}
                            className="text-[11px] font-black text-amber-400 hover:text-amber-300 underline flex items-center gap-0.5 cursor-pointer"
                            title="試算推奨額を入力欄に反映"
                          >
                            <Calculator className="w-3 h-3" />
                            推奨額 ({formatCurrency(recommended)}) を反映
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-stone-400">¥</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={currentInput}
                            onChange={(e) =>
                              setWeeklyBonusInputs({
                                ...weeklyBonusInputs,
                                [stat.userId]: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-full px-3 py-2 bg-stone-900 rounded-xl border border-stone-700 font-black text-base text-white focus:border-amber-500"
                            placeholder="例: 35000"
                          />
                        </div>

                        {/* 推奨額の計算内訳バッジ */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] text-stone-400">
                          <span className="font-bold text-amber-400">【推奨内訳】</span>
                          <span className="bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800 text-stone-300">
                            役職手当: <strong className="text-amber-300">{formatCurrency(getStaffRoleAllowance(stat))}</strong>
                            <span className="text-[9px] text-stone-400 ml-1">({stat.roleName || "役職"})</span>
                          </span>
                          <span className="bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800 text-stone-300">
                            7割歩合({storeRemainingBonusRate}%): <strong className="text-emerald-300">{formatCurrency(Math.round(stat.storeRemaining70 * (storeRemainingBonusRate / 100)))}</strong>
                          </span>
                          <span className="bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800 text-stone-300">
                            仕込み手当(¥{craftRewardRate}×{stat.craftItemsCount}品): <strong className="text-indigo-300">{formatCurrency(stat.craftItemsCount * craftRewardRate)}</strong>
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-300 mb-1">
                          査定理由・評価メモ:
                        </label>
                        <input
                          type="text"
                          value={currentNote}
                          onChange={(e) =>
                            setWeeklyBonusNotes({
                              ...weeklyBonusNotes,
                              [stat.userId]: e.target.value,
                            })
                          }
                          placeholder="例: 寿司の仕込み多数、残り利益からの歩合還元など"
                          className="w-full px-3 py-2 bg-stone-900 rounded-xl border border-stone-700 text-xs font-semibold text-white placeholder:text-stone-600 focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* 保存ボタン */}
                    <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                      <button
                        type="button"
                        onClick={() => handleSaveStaffWeeklyBonus(stat.userId)}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                          isSaved
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/40 hover:scale-[1.02]"
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-4 h-4" />
                            保存完了！
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            このスタッフのボーナスを保存
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 売上伝票の展開トグル */}
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSalesUserId(isExpandedSales ? null : stat.userId)
                      }
                      className="text-xs font-bold text-stone-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-stone-400" />
                      <span>
                        このスタッフの週内売上伝票明細 ({stat.weekSales.length}件) を
                        {isExpandedSales ? "閉じる ▲" : "確認する ▼"}
                      </span>
                    </button>

                    {/* 伝票アコーディオン */}
                    {isExpandedSales && (
                      <div className="mt-3 p-3 bg-stone-950 rounded-2xl border border-stone-800 space-y-2 max-h-56 overflow-y-auto">
                        {stat.weekSales.length === 0 ? (
                          <p className="text-xs text-stone-400 py-3 text-center">
                            この週の販売伝票はありません
                          </p>
                        ) : (
                          stat.weekSales.map((sale) => (
                            <div
                              key={sale.id}
                              className="p-2.5 bg-stone-900 rounded-xl border border-stone-800 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-amber-300">
                                    #{sale.id}
                                  </span>
                                  <span className="text-stone-400 text-[11px]">
                                    {new Date(sale.created_at).toLocaleString("ja-JP", {
                                      month: "numeric",
                                      day: "numeric",
                                      weekday: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {sale.items.map((it, i) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] text-stone-300 border border-stone-700"
                                    >
                                      {it.itemName || it.item_name} ×{it.quantity}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-white text-sm block">
                                  {formatCurrency(sale.totalAmount ?? sale.total_amount ?? 0)}
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  手渡3割: {formatCurrency(Math.round((sale.totalAmount ?? sale.total_amount ?? 0) * 0.3))} / 残り7割: {formatCurrency(Math.round((sale.totalAmount ?? sale.total_amount ?? 0) * 0.7))}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ⑤ 最下部のアクションフッター（週次確定バー） */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border border-stone-800">
            <div>
              <span className="text-xs font-bold text-amber-400 block">
                週次支給フロー（日曜始まり・土曜締め ➜ 翌週店主が決定・確定）
              </span>
              <h4 className="text-base font-black text-white mt-0.5">
                {currentWeeklySummary.weekLabel} ボーナス支給総額: {formatCurrency(currentWeeklySummary.totalBonusPayout)}
                {currentWeeklySummary.totalUnpaidCarryover > 0 && (
                  <span className="text-xs font-normal text-amber-300 ml-2">
                    (過去未払い繰越 +{formatCurrency(currentWeeklySummary.totalUnpaidCarryover)} 含む総額: {formatCurrency(currentWeeklySummary.totalDuePayout)})
                  </span>
                )}
              </h4>
              <p className="text-xs text-stone-400 mt-1">
                {currentWeeklySummary.isFinalized
                  ? `✅ ${currentWeeklySummary.finalizedBy} により確定済みです。確定解除で再編集も可能です。`
                  : "各スタッフの支給金額を保存後、確定ボタンを押して支給を正式決定してください。"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAllStaffBonuses}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors cursor-pointer"
              >
                全員分を下書き保存
              </button>
              {!currentWeeklySummary.isFinalized ? (
                <button
                  type="button"
                  onClick={handleFinalizeWeek}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-black shadow-md shadow-amber-900/40 flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  この週のボーナスを最終確定
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnfinalizeWeek}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  確定解除（金額を再編集）
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          タブ2: ⚙️ レシピ & 価格設定
      ======================================================== */}
      {activeTab === "recipes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                料理商品の販売価格 &amp; クラフトレシピ設定
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                メイン画面で販売するときの値段と、「作成」ボタンを押したときに自動消費する素材の個数を指定します
              </p>
            </div>

            {/* 店舗フィルター */}
            <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setRecipeShopFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  recipeShopFilter === "all"
                    ? "bg-stone-700 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                全店舗 ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setRecipeShopFilter("sakura")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  recipeShopFilter === "sakura"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🌸 和食さくら ({products.filter((p) => (p.shopId || "sakura") === "sakura").length})
              </button>
              <button
                type="button"
                onClick={() => setRecipeShopFilter("buon_viaggio")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  recipeShopFilter === "buon_viaggio"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                🍷 Buon viaggio ({products.filter((p) => p.shopId === "buon_viaggio").length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {products
              .filter((product) => {
                if (recipeShopFilter === "all") return true;
                return (product.shopId || "sakura") === recipeShopFilter;
              })
              .map((product) => {
              const isEditingRecipe = editingRecipeProductId === product.id;
              const currentPriceVal =
                tempPrices[product.id] !== undefined
                  ? tempPrices[product.id]
                  : product.selling_price;
              const isBuonViaggio = product.shopId === "buon_viaggio";

              return (
                <div
                  key={product.id}
                  className="bg-stone-900/90 rounded-2xl border border-stone-800 p-5 shadow-xl space-y-4 text-stone-100"
                >
                  {/* 商品ヘッダー */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-stone-950 border border-stone-700 overflow-hidden shrink-0 flex items-center justify-center">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">🍱</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">{product.name}</h3>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              isBuonViaggio
                                ? "bg-purple-950 text-purple-300 border-purple-700"
                                : "bg-rose-950 text-rose-300 border-rose-700"
                            }`}
                          >
                            {isBuonViaggio ? "🍷 Buon viaggio" : "🌸 和食さくら"}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {product.category_name} | 現在庫: <strong className="text-white">{product.current_stock}</strong> {product.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 1. 販売価格の設定 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
                    <label className="block text-[11px] font-bold text-stone-300 mb-1">
                      販売価格 (メイン画面の合計金額に反映):
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-400">¥</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={currentPriceVal}
                        onChange={(e) =>
                          setTempPrices({
                            ...tempPrices,
                            [product.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-36 px-3 py-1.5 bg-stone-900 rounded-lg border border-stone-700 font-black text-white text-sm focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSavePrice(product.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors shadow-xs cursor-pointer border border-stone-700"
                      >
                        価格を保存
                      </button>
                      <span className="text-[11px] text-stone-400 ml-auto">
                        現在: ¥{product.selling_price.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 2. クラフトレシピ (必要素材) の設定 */}
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        1つ作るのに必要な素材レシピ:
                      </label>
                      {!isEditingRecipe && (
                        <button
                          type="button"
                          onClick={() => handleStartEditRecipe(product)}
                          className="text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          レシピを編集する
                        </button>
                      )}
                    </div>

                    {!isEditingRecipe ? (
                      <div>
                        {product.recipe && product.recipe.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {product.recipe.map((r, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-stone-950 border border-amber-500/30 text-xs font-bold text-stone-200 shadow-xs"
                              >
                                {r.ingredient_name}{" "}
                                <span className="text-amber-400 font-black">×{r.quantity}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400 italic">
                            必要素材が設定されていません（素材なしで作成可能）
                          </p>
                        )}
                      </div>
                    ) : (
                      /* レシピ編集モーダル / 展開フォーム */
                      <div className="space-y-3 pt-2">
                        {/* 現在選択中の必要素材一覧 */}
                        <div className="space-y-1.5">
                          {tempRecipe.length === 0 ? (
                            <p className="text-xs text-stone-400">素材が選択されていません</p>
                          ) : (
                            tempRecipe.map((r, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-stone-950 px-3 py-1.5 rounded-lg border border-stone-800 text-xs"
                              >
                                <span className="font-bold text-stone-200">{r.ingredient_name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-amber-400">×{r.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientFromRecipe(idx)}
                                    className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* 素材追加コントロール */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-amber-500/30">
                          <select
                            value={selectedIngredientId}
                            onChange={(e) => setSelectedIngredientId(e.target.value)}
                            className="text-xs px-2 py-1.5 bg-stone-950 rounded-lg border border-stone-700 font-bold text-stone-200 flex-1 cursor-pointer"
                          >
                            {ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id} className="bg-stone-900 text-white">
                                {ing.name} (在庫: {ing.current_stock})
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-stone-400">個数:</span>
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={ingredientQuantity}
                              onChange={(e) => setIngredientQuantity(parseInt(e.target.value) || 1)}
                              className="w-14 px-2 py-1.5 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-center text-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleAddIngredientToRecipe}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> 追加
                          </button>
                        </div>

                        {/* レシピ保存ボタン */}
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingRecipeProductId(null)}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRecipe(product.id)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> レシピを決定・保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          タブ3: 🍱 商品・素材登録 & 写真管理
      ======================================================== */}
      {activeTab === "items" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: 新規商品・素材の登録フォーム */}
          <div className="bg-stone-900/90 p-5 rounded-3xl border border-stone-800 shadow-xl h-fit space-y-4 text-stone-100">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                商品・素材の新規登録
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                新メニュー（料理）や新しい食材を登録し、写真をアップロードできます
              </p>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              {/* 品目種別 */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  登録する品目の種類:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("product");
                      setItemCategory(itemShopId === "buon_viaggio" ? "ピザ・パスタ" : "寿司・料理");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      itemType === "product"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-stone-950 text-stone-400 border-stone-800 hover:text-white"
                    }`}
                  >
                    🍱 料理商品 (完成品)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("ingredient");
                      setItemCategory("海鮮・食材");
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      itemType === "ingredient"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-stone-950 text-stone-400 border-stone-800 hover:text-white"
                    }`}
                  >
                    🥬 クラフト素材 (原材料)
                  </button>
                </div>
              </div>

              {/* 料理の場合: 所属店舗の選択 */}
              {itemType === "product" ? (
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    所属店舗:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setItemShopId("sakura")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        itemShopId === "sakura"
                          ? "bg-rose-600 text-white border-rose-500 shadow-xs font-black"
                          : "bg-stone-950 text-stone-400 border-stone-800 hover:text-white"
                      }`}
                    >
                      🌸 和食さくら
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemShopId("buon_viaggio")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        itemShopId === "buon_viaggio"
                          ? "bg-purple-600 text-white border-purple-500 shadow-xs font-black"
                          : "bg-stone-950 text-stone-400 border-stone-800 hover:text-white"
                      }`}
                    >
                      🍷 Buon viaggio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                  <span>🥬</span>
                  <span>クラフト素材（原材料）は2店舗で共通利用できます</span>
                </div>
              )}

              {/* 品名 */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  品名 (料理名または素材名):
                </label>
                <input
                  type="text"
                  placeholder="例: 上うな重、和牛ステーキ、生ウニ"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-bold text-white placeholder:text-stone-600 focus:border-amber-500"
                  required
                />
              </div>

              {/* カテゴリ */}
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">カテゴリ:</label>
                <input
                  type="text"
                  placeholder="例: 寿司、刺身、肉料理、仕入素材"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white placeholder:text-stone-600 focus:border-amber-500"
                />
              </div>

              {/* 料理の場合: 販売価格 */}
              {itemType === "product" && (
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    販売価格 (¥):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-black text-amber-400 focus:border-amber-500"
                    required
                  />
                </div>
              )}

              {/* 初期在庫数 & 単位 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    初期在庫数:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemInitialStock}
                    onChange={(e) => setItemInitialStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">単位:</label>
                  <input
                    type="text"
                    placeholder="個, 人前, 本"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-white"
                  />
                </div>
              </div>

              {/* 画像アップロード */}
              <div>
                <ImageUploader
                  label="商品・素材の写真 (アップロード)"
                  currentImageUrl={itemImageUrl}
                  onImageUploaded={(url) => setItemImageUrl(url)}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-900/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                登録を完了する
              </button>
            </form>
          </div>

          {/* 右側: 登録済みアイテム一覧 & 変更・削除 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  登録済みアイテム一覧・変更・削除 ({items.length}品目)
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  品名・価格・在庫数・写真の変更や、不要になった商品の削除を行えます
                </p>
              </div>

              {/* 店舗・素材フィルター */}
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 flex-wrap">
                <button
                  type="button"
                  onClick={() => setItemShopFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    itemShopFilter === "all"
                      ? "bg-stone-700 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  すべて ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemShopFilter("sakura")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    itemShopFilter === "sakura"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  🌸 和食さくら ({items.filter((i) => i.type === "product" && (i.shopId || "sakura") === "sakura").length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemShopFilter("buon_viaggio")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    itemShopFilter === "buon_viaggio"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  🍷 Buon viaggio ({items.filter((i) => i.type === "product" && i.shopId === "buon_viaggio").length})
                </button>
                <button
                  type="button"
                  onClick={() => setItemShopFilter("ingredient")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    itemShopFilter === "ingredient"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  🥬 共通素材 ({ingredients.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items
                .filter((item) => {
                  if (itemShopFilter === "all") return true;
                  if (itemShopFilter === "ingredient") return item.type === "ingredient";
                  return item.type === "product" && (item.shopId || "sakura") === itemShopFilter;
                })
                .map((item) => {
                const isProduct = item.type === "product";
                const isBuonViaggio = isProduct && item.shopId === "buon_viaggio";
                const isEditing = editingItemId === item.id;
                const isChangingImage = changingImageItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`bg-stone-900/90 p-4 rounded-2xl border transition-all shadow-md flex flex-col justify-between text-stone-100 ${
                      isEditing ? "border-amber-400 ring-2 ring-amber-500/30" : "border-stone-800"
                    }`}
                  >
                    {!isEditing ? (
                      <div>
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-stone-950 border border-stone-700 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl">{isProduct ? "🍱" : "🥬"}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isProduct ? (
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                    isBuonViaggio
                                      ? "bg-purple-950 text-purple-300 border-purple-700"
                                      : "bg-rose-950 text-rose-300 border-rose-700"
                                  }`}
                                >
                                  {isBuonViaggio ? "🍷 Buon viaggio" : "🌸 和食さくら"}
                                </span>
                              ) : (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                                  🥬 共通素材
                                </span>
                              )}
                              <span className="text-[10px] text-stone-400 font-semibold">
                                {item.category_name}
                              </span>
                            </div>

                            <h4 className="font-bold text-white text-sm mt-0.5 truncate">
                              {item.name}
                            </h4>

                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                              <span className="text-stone-400">
                                在庫: <strong className="text-white font-black">{item.current_stock}</strong> {item.unit}
                              </span>
                              {isProduct && (
                                <span className="font-black text-amber-400">
                                  ¥{item.selling_price.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 写真変更展開 */}
                        {isChangingImage && (
                          <div className="mt-3 p-3 bg-stone-950 rounded-xl border border-stone-800">
                            <ImageUploader
                              label="新しい写真をアップロード"
                              currentImageUrl={item.image_url}
                              onImageUploaded={(newUrl) => {
                                updateItemImage(item.id, newUrl);
                                setChangingImageItemId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setChangingImageItemId(null)}
                              className="mt-2 w-full py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                            >
                              閉じる
                            </button>
                          </div>
                        )}

                        {/* 操作ボタン */}
                        {!isChangingImage && (
                          <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setChangingImageItemId(item.id)}
                              className="text-[11px] font-bold text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <ImageIcon className="w-3.5 h-3.5" /> 写真変更
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit className="w-3 h-3" /> 変更
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800 transition-colors cursor-pointer"
                                title="この品目を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* インライン品目編集フォーム */
                      <div className="space-y-3 p-1">
                        <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                          <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                            <Edit className="w-3.5 h-3.5 text-amber-500" /> 品目情報を変更
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">ID: {item.id}</span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-300 mb-0.5">品名:</label>
                            <input
                              type="text"
                              value={editItemName}
                              onChange={(e) => setEditItemName(e.target.value)}
                              className="w-full px-2.5 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-stone-300 mb-0.5">種別:</label>
                              <select
                                value={editItemType}
                                onChange={(e) => setEditItemType(e.target.value as "product" | "ingredient")}
                                className="w-full px-2 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-amber-500 cursor-pointer"
                              >
                                <option value="product" className="bg-stone-900 text-white">料理商品</option>
                                <option value="ingredient" className="bg-stone-900 text-white">クラフト素材</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-stone-300 mb-0.5">カテゴリ:</label>
                              <input
                                type="text"
                                value={editItemCategory}
                                onChange={(e) => setEditItemCategory(e.target.value)}
                                className="w-full px-2.5 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs text-white focus:border-amber-500"
                              />
                            </div>
                          </div>

                          {/* 料理商品の場合の所属店舗 */}
                          {editItemType === "product" && (
                            <div>
                              <label className="block text-[11px] font-bold text-stone-300 mb-0.5">所属店舗:</label>
                              <select
                                value={editItemShopId}
                                onChange={(e) => setEditItemShopId(e.target.value as ShopId)}
                                className="w-full px-2 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-amber-500 cursor-pointer"
                              >
                                <option value="sakura" className="bg-stone-900 text-white">🌸 和食さくら</option>
                                <option value="buon_viaggio" className="bg-stone-900 text-white">🍷 Buon viaggio</option>
                              </select>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            {editItemType === "product" ? (
                              <div>
                                <label className="block text-[11px] font-bold text-stone-300 mb-0.5">販売価格 (¥):</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="50"
                                  value={editItemPrice}
                                  onChange={(e) => setEditItemPrice(parseInt(e.target.value) || 0)}
                                  className="w-full px-2.5 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-black text-amber-400 focus:border-amber-500"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[11px] font-bold text-stone-400 mb-0.5">販売価格:</label>
                                <div className="px-2.5 py-1 bg-stone-950 rounded-lg border border-stone-800 text-xs text-stone-500">
                                  素材(販売なし)
                                </div>
                              </div>
                            )}

                            <div>
                              <label className="block text-[11px] font-bold text-stone-300 mb-0.5">在庫数 / 単位:</label>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={editItemStock}
                                  onChange={(e) => setEditItemStock(parseInt(e.target.value) || 0)}
                                  className="w-2/3 px-2 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs font-bold text-white focus:border-amber-500"
                                />
                                <input
                                  type="text"
                                  value={editItemUnit}
                                  onChange={(e) => setEditItemUnit(e.target.value)}
                                  className="w-1/3 px-1.5 py-1 bg-stone-950 rounded-lg border border-stone-700 text-xs text-white text-center focus:border-amber-500"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <ImageUploader
                              label="写真の差し替え"
                              currentImageUrl={editItemImageUrl}
                              onImageUploaded={(url) => setEditItemImageUrl(url)}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveItemEdit(item.id)}
                            className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> 保存する
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          タブ4: 📜 店舗操作ログ監査
      ======================================================== */}
      {activeTab === "logs" && (
        <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 shadow-xl space-y-4 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                店舗全操作ログ (誰が何をしたかの監査記録)
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                商品の販売、クラフト作成、在庫調整、PASS変更、レシピ設定など全アクションが記録されます
              </p>
            </div>

            {/* ログカテゴリーフィルター */}
            <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 p-1 rounded-xl flex-wrap">
              {[
                { id: "all", label: "すべて" },
                { id: "sale", label: "販売" },
                { id: "craft", label: "作成" },
                { id: "vault", label: "金庫" },
                { id: "bonus", label: "ボーナス" },
                { id: "inventory", label: "在庫調整" },
                { id: "item", label: "商品・素材" },
                { id: "role", label: "役職" },
                { id: "user", label: "従業員・PASS" },
                { id: "recipe", label: "レシピ・価格" },
                { id: "auth", label: "ログイン" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    logFilter === tab.id
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ログ一覧 */}
          <div className="divide-y divide-stone-800/80 max-h-[600px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <p className="text-xs text-stone-500 py-8 text-center">該当する操作ログはありません</p>
            ) : (
              filteredLogs.map((log) => {
                const badgeColor =
                  log.category === "sale"
                    ? "bg-rose-950/70 text-rose-300 border-rose-800/50"
                    : log.category === "craft"
                    ? "bg-amber-950/70 text-amber-300 border-amber-800/50"
                    : log.category === "vault"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : log.category === "bonus"
                    ? "bg-pink-950/70 text-pink-300 border-pink-800/50"
                    : log.category === "user"
                    ? "bg-purple-950/70 text-purple-300 border-purple-800/50"
                    : log.category === "recipe"
                    ? "bg-blue-950/70 text-blue-300 border-blue-800/50"
                    : log.category === "auth"
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-800/50"
                    : "bg-stone-800 text-stone-300 border-stone-700";

                const categoryLabel =
                  log.category === "sale"
                    ? "販売"
                    : log.category === "craft"
                    ? "クラフト作成"
                    : log.category === "vault"
                    ? "金庫連動・調整"
                    : log.category === "bonus"
                    ? "ボーナス査定"
                    : log.category === "user"
                    ? "従業員管理"
                    : log.category === "recipe"
                    ? "レシピ・価格"
                    : log.category === "auth"
                    ? "認証"
                    : "在庫調整";

                return (
                  <div key={log.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColor}`}
                        >
                          {categoryLabel}
                        </span>
                        <h4 className="font-bold text-white text-xs">{log.title}</h4>
                        <span className="text-xs text-stone-400">
                          担当:{" "}
                          <strong className="text-amber-300 font-bold bg-stone-800 border border-stone-700 px-1.5 py-0.5 rounded">
                            {log.userName}
                          </strong>
                        </span>
                      </div>
                      <p className="text-xs text-stone-300 pl-1">{log.detail}</p>
                    </div>

                    <span className="text-[11px] text-stone-500 shrink-0 font-mono">
                      {new Date(log.created_at).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          🏛️ ゲーム内金庫残高 手動調整モーダル
      ======================================================== */}
      {isVaultModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-stone-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-800 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-400" />
                ゲーム内金庫残高の手動調整
              </h2>
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-400">
              ゲーム内の金庫実数に合わせて金額を入力してください。
              （日々の売上やボーナス支払いは自動で加算・減算されます）
            </p>

            <form onSubmit={handleSaveVaultBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  新しい金庫残高 (¥):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-stone-400 font-bold text-sm">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={vaultInput === 0 ? "" : vaultInput}
                    onChange={(e) => setVaultInput(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2.5 bg-stone-950 rounded-xl border border-stone-700 font-black text-xl text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 tracking-wide"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* クイック加算・設定ボタン */}
              <div>
                <span className="text-[11px] font-bold text-stone-400 block mb-1">クイック加算 / 操作:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[100000, 500000, 1000000, 5000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setVaultInput((prev) => prev + amt)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-stone-300 hover:text-amber-300 cursor-pointer transition-colors"
                    >
                      +{formatCurrency(amt)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setVaultInput(0)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-rose-950/40 border border-stone-700 text-xs font-bold text-stone-400 hover:text-rose-400 cursor-pointer transition-colors"
                  >
                    リセット (¥0)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  調整理由・メモ:
                </label>
                <input
                  type="text"
                  placeholder="例: ゲーム内金庫と同期、臨時出資、機材購入など"
                  value={vaultReason}
                  onChange={(e) => setVaultReason(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 rounded-xl border border-stone-700 text-xs text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-stone-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-md shadow-amber-950/40 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  金庫残高を更新する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
