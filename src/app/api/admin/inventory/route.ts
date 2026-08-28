import { getSupabase, type Database } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";
import { INVENTORY_CATEGORIES, todayISO } from "@/lib/types";

// Add item (owner only)
export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { name?: string; price?: number; stock?: number; cat?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const name = (body.name || "").trim();
  if (!name) return errorJson("Enter item name.", 400);
  const price = Math.max(0, Number(body.price) || 0);
  const stock = Math.max(0, Number(body.stock) || 0);
  const cat = INVENTORY_CATEGORIES.includes(body.cat || "")
    ? (body.cat as string)
    : "Other";

  const sb = getSupabase();
  const res = await sb
    .from("inventory")
    .insert({ name, price, stock, cat })
    .select("id")
    .single();
  if (res.error) return errorJson("Could not add item.", 500);

  await sb.from("stock_log").insert({
    type: "add",
    text: `<strong>${session.user}</strong> added <strong>${name}</strong>`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ ok: true, id: res.data.id });
}

// Edit item (owner only)
export async function PATCH(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: {
    id?: number;
    name?: string;
    price?: number;
    stock?: number;
    cat?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return errorJson("Invalid id.", 400);

  const sb = getSupabase();
  const cur = await sb
    .from("inventory")
    .select("id, name, price, stock, cat, active")
    .eq("id", id)
    .maybeSingle();
  if (cur.error || !cur.data) return errorJson("Item not found.", 404);
  const existing = cur.data as {
    id: number;
    name: string;
    price: number;
    stock: number;
    cat: string;
    active: boolean | null;
  };

  const name = (body.name || "").trim() || existing.name;
  const price = Math.max(0, Number(body.price) || existing.price);
  const stock = Math.max(0, Number(body.stock) || 0);
  const cat = INVENTORY_CATEGORIES.includes(body.cat || "")
    ? (body.cat as string)
    : existing.cat;
  const diff = stock - existing.stock;

  // Only touch `active` when the caller explicitly sent it. This keeps the
  // PATCH backward compatible with callers that don't know about the flag.
  const patch: Database["public"]["Tables"]["inventory"]["Update"] = {
    name,
    price,
    stock,
    cat,
  };
  if (body.active === true || body.active === false) {
    patch.active = body.active;
  }

  const upd = await sb.from("inventory").update(patch).eq("id", id);
  if (upd.error) return errorJson("Could not update item.", 500);

  await sb.from("stock_log").insert({
    type: "edit",
    text: `<strong>${session.user}</strong> edited <strong>${name}</strong>${
      diff !== 0 ? ` stock ${diff > 0 ? "+" : ""}${diff}` : ""
    }`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ ok: true });
}

// Delete item (owner only)
export async function DELETE(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) return errorJson("Invalid id.", 400);

  const sb = getSupabase();
  const cur = await sb
    .from("inventory")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const name = cur.data?.name || `#${id}`;

  const del = await sb.from("inventory").delete().eq("id", id);
  if (del.error) return errorJson("Could not delete item.", 500);

  await sb.from("stock_log").insert({
    type: "remove",
    text: `<strong>${session.user}</strong> removed <strong>${name}</strong>`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ ok: true });
}
