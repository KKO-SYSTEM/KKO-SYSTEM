import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { navForRole } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/permissions";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let orgName = "โรงพยาบาลส่งเสริมสุขภาพตำบล";
  try {
    const org = await queryOne<{ org_name: string }>(`SELECT org_name FROM org_settings WHERE id = 1`);
    if (org?.org_name) orgName = org.org_name;
  } catch {
    /* ใช้ค่าเริ่มต้นถ้าอ่านไม่ได้ */
  }

  return (
    <AppShell
      nav={navForRole(user.role)}
      user={{ fullName: user.fullName, roleLabel: ROLE_LABEL[user.role] ?? user.role }}
      orgName={orgName}
    >
      {children}
    </AppShell>
  );
}
