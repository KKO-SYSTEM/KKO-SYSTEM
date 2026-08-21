import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!canManageUsers(user.role)) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงหน้าตั้งค่าระบบได้
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">⚙️ ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          ข้อมูลหน่วยงานสำหรับหัวเอกสาร และการจัดการบัญชีผู้ใช้งาน
        </p>
      </div>
      <SettingsManager currentUserId={user.id} />
    </div>
  );
}
