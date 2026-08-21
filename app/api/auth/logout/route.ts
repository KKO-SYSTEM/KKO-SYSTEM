import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await writeAudit({ user, moduleKey: "system", action: "ออกจากระบบ" });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
