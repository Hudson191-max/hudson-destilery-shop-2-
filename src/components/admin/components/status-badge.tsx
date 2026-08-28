// Order status badge — wraps statusBadgeClass so pages share one component.
import { statusBadgeClass } from "../admin-helpers";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={statusBadgeClass(status)}>{status}</span>
  );
}
