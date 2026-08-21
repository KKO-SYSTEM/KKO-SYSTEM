import { MODULES } from "./modules";
import { canAccessModule, canManageUsers, canViewAudit } from "./permissions";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: string;
  /** เมนูย่อยของระบบงาน */
  children?: { href: string; label: string; icon?: string }[];
}

/** เมนูตามโปสเตอร์ — Dashboard, 10 ระบบงาน, รายงาน, ตั้งค่าระบบ */
export function navForRole(role: string): NavItem[] {
  const items: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: "📊" },
  ];

  for (const mod of Object.values(MODULES)) {
    if (!canAccessModule(role, mod.key)) continue;
    items.push({
      key: mod.key,
      href: `/m/${mod.key}`,
      label: mod.shortLabel,
      icon: mod.icon,
      children: mod.subPages.map((sp) => ({
        href: sp.slug ? `/m/${mod.key}/${sp.slug}` : `/m/${mod.key}`,
        label: sp.label,
        icon: sp.icon,
      })),
    });
  }

  items.push({ key: "reports", href: "/reports", label: "รายงาน", icon: "📄" });

  if (canViewAudit(role)) {
    items.push({ key: "audit", href: "/audit", label: "Audit Log", icon: "🕒" });
  }
  if (canManageUsers(role)) {
    items.push({ key: "settings", href: "/settings", label: "ตั้งค่าระบบ", icon: "⚙️" });
  }

  return items;
}
