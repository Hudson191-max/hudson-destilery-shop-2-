import type { Metadata } from "next";
import AdminApp from "@/components/admin/admin-app";

// Staff-only area: keep it out of search results entirely.
export const metadata: Metadata = {
  title: "Staff Panel — The Hudson Distillery",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
