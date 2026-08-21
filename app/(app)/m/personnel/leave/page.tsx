import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule, canApprove } from "@/lib/permissions";
import ModuleTabs from "@/components/ModuleTabs";
import LeaveManager from "@/components/LeaveManager";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const mod = getModule("personnel")!;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canAccessModule(user.role, "personnel")) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        คุณไม่มีสิทธิ์เข้าถึงระบบบุคลากร
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">📝 ระบบการลา</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555 — ครบทั้ง 11 ประเภทการลา
        </p>
      </div>

      <ModuleTabs mod={mod} />
      <LeaveManager canApprove={canApprove(user.role)} />
    </div>
  );
}
