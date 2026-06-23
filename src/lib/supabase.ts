import { createClient } from "@supabase/supabase-js";

// Supabase credentials for The Hudson Distillery backend.
// These are used SERVER-SIDE only so the anon key never ships to the client
// and we can strip sensitive fields before returning data to the browser.
export const SUPA_URL = "https://vsnwtvnxugogghxpsgkh.supabase.co";
const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzbnd0dm54dWdvZ2doeHBzZ2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTMwNjcsImV4cCI6MjA5Nzc4OTA2N30.9WpxzBBwKi_WB3xKZrqx8aAGVP-dNWjAR6fzvRLIZcg";

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
          role: string;
          password_hash: string;
          salt: string;
        };
        Insert: { role: string; password_hash: string; salt: string };
        Update: {
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
