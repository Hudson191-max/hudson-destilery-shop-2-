// The Supabase package is provided by the application's dependency install.
// @ts-expect-error The editor may report this while dependencies are not installed.
import { createClient } from "@supabase/supabase-js";

// Supabase credentials for The Hudson Distillery backend.
// These are used SERVER-SIDE only; never commit the service-role key.
const runtimeEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;
const SUPA_URL = runtimeEnv?.SUPABASE_URL;
const SUPA_KEY = runtimeEnv?.SUPABASE_SECRET_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured");
}

// Minimal Database type so the query builder knows our table shapes (avoids
// the default `never` inference from untyped tables). Each table must declare
// Relationships: [] to satisfy Supabase's GenericTable constraint.
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
      inventory: {
        Row: {
          id: number | string;
          name: string;
          price: number;
          stock: number;
          cat: string;
        };
        Insert: {
          id?: number;
          name: string;
          price?: number;
          stock?: number;
          cat?: string;
        };
        Update: {
          id?: number;
          name?: string;
          price?: number;
          stock?: number;
          cat?: string;
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

let _client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (_client) return _client;
  _client = createClient<Database>(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
