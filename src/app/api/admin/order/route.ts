import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { todayISO, type OrderLine } from "@/lib/types";

export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: {
    customer?: string;
    contact?: string;
    notes?: string;
    lines?: { itemId: number; name: string; qty: number; price: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const customer = (body.customer || "").trim();
  if (!customer) return errorJson("Enter customer name.", 400);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) return errorJson("Add at least one item.", 400);

  const sb = getSupabase();
  const res = await sb
    .from("orders")
    .insert({
      customer,
      contact: (body.contact || "").trim(),
      lines: JSON.stringify(lines as OrderLine[]),
      notes: (body.notes || "").trim(),
      status: "Preparing",
      date: todayISO(),
      created_by: session.user,
    })
    .select("id")
    .single();

  if (res.error || !res.data)
    return errorJson("Order creation failed.", 500);

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  await sb.from("stock_log").insert({
    type: "order",
    text: `Order #${res.data.id} created for <strong>${customer}</strong> — ${total.toLocaleString()} R`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ id: res.data.id });
}
