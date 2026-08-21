import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canViewAudit } from "@/lib/permissions";
import AuditViewer from "@/components/AuditViewer";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canViewAudit(user.role)) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        เฉพาะผู้ดูแลระบบและผู้บริหารเท่านั้นที่ดู Audit Log ได้
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">🕒 Audit Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          ประวัติการใช้งานระบบทั้งหมด — บันทึกทุกการเพิ่ม แก้ไข ลบ และการเข้าใช้งาน
        </p>
      </div>
      <AuditViewer />
    </div>
  );
}
