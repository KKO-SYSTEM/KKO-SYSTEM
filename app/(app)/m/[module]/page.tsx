import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule } from "@/lib/permissions";
import ModuleTabs from "@/components/ModuleTabs";
import RecordManager from "@/components/RecordManager";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = await params;

  const mod = getModule(moduleKey);
  if (!mod) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, moduleKey)) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        คุณไม่มีสิทธิ์เข้าถึง{mod.label} — หากต้องการใช้งาน กรุณาติดต่อผู้ดูแลระบบ
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">
          {mod.icon} {mod.label}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{mod.description}</p>
      </div>

      <ModuleTabs mod={mod} />
      <RecordManager mod={mod} />
    </div>
  );
}
