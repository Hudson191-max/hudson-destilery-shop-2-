// ── Data layer with automatic local fallback ─────────────────────────────────
// Production: set SUPABASE_URL + SUPABASE_SECRET_KEY and every query goes to
// Supabase exactly as before (service-role key, server-side only).
//
// Development / self-hosting without Supabase: when those env vars are absent,
// getSupabase() returns a local, Prisma-backed client that implements the same
// fluent query-builder subset the app uses (from/select/eq/neq/in/gte/lte/lt/
// order/limit/range/maybeSingle/single/insert/update/upsert/delete). All API
// routes work unchanged against either backend.
import { db } from "./db";

const runtimeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;
const SUPA_URL = runtimeEnv?.SUPABASE_URL;
const SUPA_KEY = runtimeEnv?.SUPABASE_SECRET_KEY;

// Minimal Database type so the Supabase query builder knows our table shapes.
// (Kept byte-compatible with the original definition — import/export rely on it.)
export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: number | string;
          customer: string;
          contact: string | null;
          steam: string | null;
          lines: string | null;
          notes: string | null;
          status: string;
          date: string | null;
          created_by: string | null;
          cancel_code: string | null;
          closed_at: number | null;
        };
        Insert: {
          id?: number;
          customer: string;
          contact?: string | null;
          steam?: string | null;
          lines?: string | null;
          notes?: string | null;
          status?: string;
          date?: string | null;
          created_by?: string | null;
          cancel_code?: string | null;
          closed_at?: number | null;
        };
        Update: {
          id?: number;
          customer?: string;
          contact?: string | null;
          steam?: string | null;
          lines?: string | null;
          notes?: string | null;
          status?: string;
          date?: string | null;
          created_by?: string | null;
          cancel_code?: string | null;
          closed_at?: number | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: number;
          author: string;
          content: string;
          created_at: number;
        };
        Insert: { id?: number; author: string; content: string; created_at: number };
        Update: {
          id?: number;
          author?: string;
          content?: string;
          created_at?: number;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          id: number | string;
          name: string;
          price: number;
          stock: number;
          cat: string;
          // When false the item is hidden from the public order page.
          active: boolean | null;
        };
        Insert: {
          id?: number;
          name: string;
          price?: number;
          stock?: number;
          cat?: string;
          active?: boolean | null;
        };
        Update: {
          id?: number;
          name?: string;
          price?: number;
          stock?: number;
          cat?: string;
          active?: boolean | null;
        };
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: { key?: string; value?: string };
        Relationships: [];
      };
      stock_log: {
        Row: {
          id: number;
          type: string;
          text: string;
          who: string | null;
          ts: string | null;
          date: string | null;
        };
        Insert: {
          id?: number;
          type: string;
          text: string;
          who?: string | null;
          ts?: string | null;
          date?: string | null;
        };
        Update: {
          id?: number;
          type?: string;
          text?: string;
          who?: string | null;
          ts?: string | null;
          date?: string | null;
        };
        Relationships: [];
      };
      auth: {
        Row: {
          username: string;
          role: string;
          password_hash: string;
          salt: string;
        };
        Insert: { username: string; role: string; password_hash: string; salt: string };
        Update: {
          username?: string;
          role?: string;
          password_hash?: string;
          salt?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ── Real Supabase client (production) ────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _real: SupabaseClient<Database> | null = null;

function getRealSupabase(): SupabaseClient<Database> | null {
  if (!SUPA_URL || !SUPA_KEY) return null;
  if (_real) return _real;
  _real = createClient<Database>(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _real;
}

// ── Local Prisma-backed shim (dev / zero-config) ───────────────────────────

type Filter = { col: string; op: "eq" | "neq" | "in" | "gte" | "lte" | "lt"; val: any };

// table → { prisma model delegate, integer columns, bigint columns, primary key }
const TABLE_MAP: Record<
  string,
  { model: string; ints: string[]; bigints: string[]; pk: string }
> = {
  orders: { model: "order", ints: ["id"], bigints: ["closed_at"], pk: "id" },
  inventory: { model: "inventory", ints: ["id", "price", "stock"], bigints: [], pk: "id" },
  settings: { model: "setting", ints: [], bigints: [], pk: "key" },
  stock_log: { model: "stockLog", ints: ["id"], bigints: [], pk: "id" },
  auth: { model: "auth", ints: [], bigints: [], pk: "username" },
  messages: { model: "message", ints: ["id"], bigints: ["created_at"], pk: "id" },
};

function coerceVal(spec: { ints: string[]; bigints: string[] }, col: string, v: any): any {
  if (v == null) return v;
  if (spec.bigints.includes(col)) {
    if (typeof v === "number") return BigInt(v);
    if (typeof v === "string" && v !== "" && /^\d+$/.test(v)) return BigInt(v);
    return v;
  }
  if (spec.ints.includes(col)) {
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    }
    return v;
  }
  return v;
}

function coerceRow(
  spec: { ints: string[]; bigints: string[] },
  row: Record<string, any>
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue; // Prisma rejects undefined values
    out[k] = coerceVal(spec, k, v);
  }
  return out;
}

function dehydrate(row: any): any {
  if (row == null) return row;
  if (Array.isArray(row)) return row.map(dehydrate);
  if (typeof row === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return out;
  }
  return row;
}

function parseCols(cols?: string | null): Record<string, true> | undefined {
  const c = (cols || "").trim();
  if (!c || c === "*") return undefined;
  const sel: Record<string, true> = {};
  for (const part of c.split(",")) {
    const name = part.trim();
    if (name) sel[name] = true;
  }
  return Object.keys(sel).length ? sel : undefined;
}

function supaError(err: unknown): { message: string; code?: string } {
  const e = err as { message?: string; code?: string };
  return { message: e?.message || "Database error.", code: e?.code };
}

class LocalQuery {
  private table: string;
  private spec: { model: string; ints: string[]; bigints: string[]; pk: string };
  private mode: "select" | "insert" | "update" | "upsert" | "delete";
  private payload: any;
  private filters: Filter[] = [];
  private cols?: string;
  private orderSpec?: { col: string; ascending: boolean };
  private take?: number;
  private skip?: number;
  private wantSingle = false;

  constructor(
    table: string,
    mode: "select" | "insert" | "update" | "upsert" | "delete",
    payload?: any
  ) {
    this.table = table;
    this.spec =
      TABLE_MAP[table] ||
      { model: table, ints: [], bigints: [], pk: "id" };
    this.mode = mode;
    this.payload = payload;
  }

  select(cols?: string): LocalQuery {
    this.cols = cols;
    return this;
  }
  eq(col: string, val: any): LocalQuery {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  neq(col: string, val: any): LocalQuery {
    this.filters.push({ col, op: "neq", val });
    return this;
  }
  in(col: string, vals: any[]): LocalQuery {
    this.filters.push({ col, op: "in", val: vals });
    return this;
  }
  gte(col: string, val: any): LocalQuery {
    this.filters.push({ col, op: "gte", val });
    return this;
  }
  lte(col: string, val: any): LocalQuery {
    this.filters.push({ col, op: "lte", val });
    return this;
  }
  lt(col: string, val: any): LocalQuery {
    this.filters.push({ col, op: "lt", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): LocalQuery {
    this.orderSpec = { col, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number): LocalQuery {
    this.take = n;
    return this;
  }
  range(start: number, endInclusive: number): LocalQuery {
    this.skip = start;
    this.take = endInclusive - start + 1;
    return this;
  }

  private buildWhere(): Record<string, any> {
    const where: Record<string, any> = {};
    for (const f of this.filters) {
      const v = coerceVal(this.spec, f.col, f.val);
      const cond =
        f.op === "eq"
          ? { equals: v }
          : f.op === "neq"
            ? { not: v }
            : f.op === "in"
              ? { in: (Array.isArray(v) ? v : [v]).map((x: any) => coerceVal(this.spec, f.col, x)) }
              : { [f.op]: v };
      where[f.col] = where[f.col] ? { ...where[f.col], ...cond } : cond;
    }
    return where;
  }

  private async run(): Promise<{ data: any; error: any }> {
    const delegate = (db as any)[this.spec.model];
    if (!delegate)
      return { data: null, error: { message: `Unknown table "${this.table}".` } };

    const where = this.buildWhere();
    const select = parseCols(this.cols);

    try {
      if (this.mode === "select") {
        let rows = await delegate.findMany({
          where,
          ...(select ? { select } : {}),
          ...(this.orderSpec
            ? { orderBy: { [this.orderSpec.col]: this.orderSpec.ascending ? "asc" : "desc" } }
            : {}),
          ...(this.take != null ? { take: this.take } : {}),
          ...(this.skip != null ? { skip: this.skip } : {}),
        });
        rows = dehydrate(rows);
        if (this.wantSingle) {
          const row = rows[0];
          if (!row) return { data: null, error: { message: "No rows found.", code: "PGRST116" } };
          return { data: row, error: null };
        }
        return { data: rows, error: null };
      }

      if (this.mode === "insert") {
        const data = coerceRow(this.spec, this.payload);
        if (Array.isArray(this.payload)) {
          const rows = (this.payload as any[]).map((p) => coerceRow(this.spec, p));
          await delegate.createMany({ data: rows });
          // Supabase returns the inserted rows when .select() is chained;
          // without it, data stays null. Our callers never read it here.
          if (select) {
            const fresh = await delegate.findMany({
              where: { id: { in: rows.map((r: any) => r.id).filter((x: any) => x != null) } },
              ...(select === undefined ? {} : { select }),
            });
            return { data: dehydrate(fresh), error: null };
          }
          return { data: null, error: null };
        }
        const row = await delegate.create({ data, ...(select ? { select } : {}) });
        return { data: dehydrate(row), error: null };
      }

      if (this.mode === "update") {
        await delegate.updateMany({ where, data: coerceRow(this.spec, this.payload) });
        return { data: [], error: null };
      }

      if (this.mode === "upsert") {
        const data = coerceRow(this.spec, this.payload);
        const pkVal = data[this.spec.pk];
        await delegate.upsert({
          where: { [this.spec.pk]: pkVal },
          update: data,
          create: data,
        });
        return { data: null, error: null };
      }

      // delete
      await delegate.deleteMany({ where });
      return { data: [], error: null };
    } catch (err) {
      return { data: null, error: supaError(err) };
    }
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    return this.run().then((r) => {
      if (r.error) return r;
      // Supabase maybeSingle resolves to the row object (or null), never an array.
      const d = Array.isArray(r.data) ? r.data[0] ?? null : r.data ?? null;
      return { data: d, error: null };
    });
  }

  single(): Promise<{ data: any; error: any }> {
    this.wantSingle = true;
    return this.run();
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

class LocalSupabase {
  from(table: string): LocalQuery {
    // Bare .from().insert/update/upsert/delete chains start a write; a plain
    // await with no mode would be a select, but our code always chains
    // .select() for reads, so default to "select".
    return new LocalQuery(table, "select");
  }
}

// from(table).insert(...) must return an insert query — handled by wrapping:
// We expose from() with an interceptor object instead of a raw LocalQuery.
type QueryFactory = LocalQuery & {
  insert: (payload: any) => LocalQuery;
  update: (patch: any) => LocalQuery;
  upsert: (row: any) => LocalQuery;
  delete: () => LocalQuery;
};

function fromTable(table: string): QueryFactory {
  const base = new LocalQuery(table, "select") as QueryFactory;
  base.insert = (payload: any) => new LocalQuery(table, "insert", payload);
  base.update = (patch: any) => new LocalQuery(table, "update", patch);
  base.upsert = (row: any) => new LocalQuery(table, "upsert", row);
  base.delete = () => new LocalQuery(table, "delete");
  return base;
}

// ── Public entrypoint ────────────────────────────────────────────────────────
// Always typed as the real Supabase client so route code compiles identically
// against either backend; the local shim satisfies it via a structural cast.
let _local: LocalSupabase | null = null;

export function getSupabase(): SupabaseClient<Database> {
  const real = getRealSupabase();
  if (real) return real;
  if (!_local) {
    _local = new LocalSupabase();
    // Route from() through the write-aware factory.
    _local.from = fromTable;
  }
  return _local as unknown as SupabaseClient<Database>;
}
