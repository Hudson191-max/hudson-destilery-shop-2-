// Shared types for the admin panel (UI-level, separate from lib/types.ts).

export type Role = "employee" | "owner" | "customer";

export type Page =
  | "dashboard"
  | "inventory"
  | "needed"
  | "stock-log"
  | "track"
  | "history"
  | "payroll"
  | "chat";

export interface NavItem {
  id: Page;
  icon: string;
  label: string;
}

// Sidebar navigation. Customers only get the track page; owners get the
// payroll + history pages on top of the staff pages. Order must match the
// original admin (dashboard → inventory → needed → stock log → chat →
// payroll → history).
export function buildNavItems(
  isCustomer: boolean,
  isOwner: boolean
): NavItem[] {
  if (isCustomer) {
    return [{ id: "track", icon: "🔍", label: "Track order" }];
  }
  return [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "inventory", icon: "📦", label: "Inventory" },
    { id: "needed", icon: "🛒", label: "What we need" },
    { id: "stock-log", icon: "📝", label: "Stock log" },
    { id: "chat", icon: "💬", label: "Chat" },
    ...(isOwner
      ? [
          { id: "payroll" as Page, icon: "💰", label: "Payroll" },
          { id: "history" as Page, icon: "🗂️", label: "History" },
        ]
      : []),
  ];
}
