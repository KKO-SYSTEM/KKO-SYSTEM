"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export default function AppShell({
  nav,
  user,
  orgName,
  children,
}: {
  nav: NavItem[];
  user: { fullName: string; roleLabel: string };
  orgName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(() => {
    const active = nav.find((n) => n.href !== "/dashboard" && pathname.startsWith(n.href));
    return active?.key ?? null;
  });

  const current = nav.find((n) =>
    n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href),
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ───── Sidebar ───── */}
      <aside
        className={`no-print fixed z-30 inset-y-0 left-0 w-72 bg-brand-900 text-white flex flex-col
          transform transition-transform duration-200 lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 py-4 border-b border-white/10 shrink-0">
          <div className="font-bold leading-tight">RPHC Smart Management</div>
          <div className="text-[11px] text-brand-200 mt-0.5 truncate">{orgName}</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {nav.map((item) => {
            const isActive =
              item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const hasChildren = (item.children?.length ?? 0) > 1;
            const isExpanded = expanded === item.key;

            return (
              <div key={item.key}>
                <div className="flex items-stretch">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex-1 flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition min-w-0
                      ${isActive ? "bg-white/15 font-semibold" : "text-brand-50 hover:bg-white/10"}`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                  {hasChildren && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : item.key)}
                      aria-label="เปิด/ปิดเมนูย่อย"
                      className="px-2 text-brand-200 hover:text-white text-xs"
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  )}
                </div>

                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-0.5 mb-1 space-y-0.5 border-l border-white/15 pl-2">
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className={`block text-[13px] px-2.5 py-1.5 rounded-md truncate transition
                          ${pathname === child.href ? "bg-white/15 text-white font-medium" : "text-brand-100 hover:bg-white/10"}`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <div className="text-sm font-medium truncate">{user.fullName}</div>
          <div className="text-[11px] text-brand-200 mb-2">{user.roleLabel}</div>
          <button
            onClick={logout}
            className="w-full text-xs bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="no-print fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ───── Main ───── */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen min-w-0">
        <header className="no-print sticky top-0 z-10 bg-white border-b px-3 sm:px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded hover:bg-slate-100 shrink-0"
            aria-label="เปิดเมนู"
          >
            ☰
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 truncate">
              {current?.label ?? "Dashboard"}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
