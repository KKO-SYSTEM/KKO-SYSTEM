import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { getModule } from "@/lib/modules";
import ModuleTabs from "@/components/ModuleTabs";
import RequisitionDetail from "@/components/RequisitionDetail";

export const dynamic = "force-dynamic";

export default async function PharmacyRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "pharmacy")) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
        คุณไม่มีสิทธิ์เข้าถึงระบบคลังยา
      </div>
    );
  }

  const mod = getModule("pharmacy")!;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">🧾 รายละเอียดใบเบิกยา</h1>
        <p className="text-sm text-slate-500 mt-0.5">{mod.label}</p>
      </div>
      <ModuleTabs mod={mod} />
      <RequisitionDetail id={Number(id)} kind="drug" />
    </div>
  );
}
