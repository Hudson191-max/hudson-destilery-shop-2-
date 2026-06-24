import { getSession } from "@/lib/auth";
import { json } from "@/lib/api-helpers";

export async function GET() {
  const s = await getSession();
  if (!s) return json({ session: null });
  return json({ session: s });
}
