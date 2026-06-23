"use client";
import { create } from "zustand";

export type ToastType = "ok" | "err";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  detail?: string;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, type?: ToastType, detail?: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, type = "ok", detail) => {
    const id = ++counter;
    set((s) => ({ items: [...s.items, { id, message, type, detail }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      }, type === "err" ? 5000 : 3000);
    }
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export function toast(message: string, type?: ToastType, detail?: string) {
  useToastStore.getState().push(message, type, detail);
}
