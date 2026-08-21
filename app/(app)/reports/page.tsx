import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ReportGenerator from "@/components/ReportGenerator";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">📄 รายงาน</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          สร้างร่างรายงานราชการจากข้อมูลจริงในระบบ แก้ไขข้อความได้ก่อนนำไปใช้
        </p>
      </div>
      <ReportGenerator />
    </div>
  );
}
