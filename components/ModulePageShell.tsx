import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule } from "@/lib/permissions";
import ModuleTabs from "@/components/ModuleTabs";

/**
 * โครงหน้าร่วมของเมนูย่อยที่มีหน้าจอเฉพาะของตัวเอง
 * ตรวจสิทธิ์ → แสดงหัวเรื่อง → แท็บเมนูย่อยของระบบงาน → เนื้อหา
 */
export default async function ModulePageShell({
  moduleKey,
  title,
  subtitle,
  actions,
  children,
}: {
  moduleKey: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const mod = getModule(moduleKey);
  if (!mod) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canAccessModule(user.role, moduleKey)) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        คุณไม่มีสิทธิ์เข้าถึง{mod.label}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="no-print shrink-0">{actions}</div>}
      </div>

      <ModuleTabs mod={mod} />
      {children}
    </div>
  );
}
