import { createClient } from "@supabase/supabase-js";
import { initialItems, mockStaffUsers, initialSales, initialActionLogs } from "./data/mockData.js";

const url = "https://hryjqehgqvacnhfnsguh.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeWpxZWhncXZhY25oZm5zZ3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODAwMTYsImV4cCI6MjEwNDM1NjAxNn0.5oAPv5z7ozuTGhzv5lJET8PEL35P2eKHq0y2d19K8jg";
const client = createClient(url, key);

async function seed() {
  console.log("Seeding sakura_items...");
  const records = initialItems.map((item) => ({
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
    updated_at: new Date().toISOString(),
  }));

  const { error: itemErr } = await client.from("sakura_items").upsert(records);
  if (itemErr) console.error("Item error:", itemErr);
  else console.log(`Seeded ${records.length} items successfully!`);

  console.log("Seeding sakura_system_state...");
  await client.from("sakura_system_state").upsert([
    { key: "vault_balance", value: { balance: 3000000 }, updated_at: new Date().toISOString() },
    { key: "users", value: mockStaffUsers, updated_at: new Date().toISOString() },
  ]);

  console.log("Seeding initial sales...");
  for (const s of initialSales) {
    await client.from("sakura_sales").upsert({
      id: s.id,
      shop_id: s.shopId || "sakura",
      staff_name: s.staffName || "店員",
      staff_user_id: s.staffUserId || null,
      total_amount: s.totalAmount || 0,
      items: s.items || [],
      created_at: s.created_at,
    });
  }

  console.log("Seeding initial logs...");
  for (const l of initialActionLogs) {
    await client.from("sakura_action_logs").upsert({
      id: l.id,
      user_name: l.userName,
      user_role: l.userRole,
      category: l.category,
      title: l.title,
      detail: l.detail,
      created_at: l.created_at,
    });
  }

  console.log("Seed completed!");
}

seed();
