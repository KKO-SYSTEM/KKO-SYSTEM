import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule } from "@/lib/permissions";
import ModuleTabs from "@/components/ModuleTabs";

/**
 * โครงหน้าร่วมของหน้าย่อยในคลังยา/คลังวัคซีน
 * ตรวจสิทธิ์ + แสดงหัวเรื่อง + แท็บเมนูย่อย
 */
export default async function StockPageShell({
  moduleKey,
  title,
  subtitle,
  children,
}: {
  moduleKey: "pharmacy" | "vaccine";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const mod = getModule(moduleKey)!;
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
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <ModuleTabs mod={mod} />
      {children}
    </div>
  );
}
