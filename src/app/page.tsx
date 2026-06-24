"use client";

import { useSyncExternalStore } from "react";
import OrderView from "@/components/order/order-view";
import AdminApp from "@/components/admin/admin-app";

type View = "order" | "admin";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
  };
}

function getSnapshot(): View {
  const v = new URLSearchParams(window.location.search).get("view");
  return v === "order" ? "order" : "admin";
}

function getServerSnapshot(): View {
  return "admin";
}

export default function Home() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (view === "order") return <OrderView />;
  return <AdminApp />;
}
