import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule } from "@/lib/permissions";
import ModuleTabs from "@/components/ModuleTabs";

export const dynamic = "force-dynamic";

/**
 * หน้าเมนูย่อยที่ยังพัฒนาไม่เสร็จ
 *
 * หน้าที่สร้างเสร็จแล้วจะมีไฟล์ของตัวเอง (static segment) ซึ่ง Next.js ให้ความสำคัญก่อน
 * หน้าที่ยังไม่มีไฟล์จะตกมาที่นี่ เพื่อไม่ให้เมนูกดแล้วขึ้น 404
 */
export default async function ModuleSubPage({
  params,
}: {
  params: Promise<{ module: string; sub: string[] }>;
}) {
  const { module: moduleKey, sub } = await params;

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

  const slug = sub.join("/");
  const page = mod.subPages.find((sp) => sp.slug === slug);
  if (!page) notFound();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-800">
          {page.icon} {page.label}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{mod.label}</p>
      </div>

      <ModuleTabs mod={mod} />

      <div className="bg-white rounded-xl border p-8 text-center">
        <div className="text-4xl mb-3">🚧</div>
        <div className="font-semibold text-slate-700 mb-1">หน้านี้อยู่ระหว่างการพัฒนา</div>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          ส่วน &ldquo;{page.label}&rdquo; ของ{mod.label} ยังพัฒนาไม่เสร็จ
          <br />
          ฟังก์ชันจะทยอยเปิดใช้งานตามลำดับการพัฒนา
        </p>
      </div>
    </div>
  );
}
