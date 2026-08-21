"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleDef } from "@/lib/modules";

export default function ModuleTabs({ mod }: { mod: ModuleDef }) {
  const pathname = usePathname();
  if (mod.subPages.length < 2) return null;

  return (
    <div className="no-print flex gap-1 overflow-x-auto pb-1 mb-4 border-b">
      {mod.subPages.map((sp) => {
        const href = sp.slug ? `/m/${mod.key}/${sp.slug}` : `/m/${mod.key}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 text-sm px-3.5 py-2 rounded-t-lg border-b-2 transition whitespace-nowrap
              ${
                active
                  ? "border-brand-600 text-brand-700 font-medium bg-brand-50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
          >
            {sp.icon && <span className="mr-1">{sp.icon}</span>}
            {sp.label}
          </Link>
        );
      })}
    </div>
  );
}
