import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";
import { getWhitelist, saveWhitelist } from "@/lib/auth";

export async function GET() {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);
  const wl = await getWhitelist();
  return json({ employee: wl.employee, owner: wl.owner });
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { employee?: string[]; owner?: string[] };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const employee = Array.isArray(body.employee) ? body.employee : [];
  const owner = Array.isArray(body.owner) ? body.owner : [];

  await saveWhitelist(employee, owner);
  // No localStorage override — read-back from DB only.
  const fresh = await getWhitelist();
  return json({ ok: true, employee: fresh.employee, owner: fresh.owner });
}

// Re-export the supabase client reference to keep this module self-contained.
void getSupabase;
