import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canManageUsers } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = [
  "org_name",
  "parent_org",
  "district",
  "province",
  "director_name",
  "director_title",
  "address",
  "phone",
] as const;

/** GET /api/org — ข้อมูลหน่วยงาน (ใช้เป็นหัวเอกสารที่พิมพ์ออก) */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    const row = await queryOne(`SELECT * FROM org_settings WHERE id = 1`);
    return NextResponse.json({ org: row ?? {} });
  } catch {
    return NextResponse.json({ org: {} });
  }
}

/** PUT /api/org — แก้ไขข้อมูลหน่วยงาน (แอดมินเท่านั้น) */
export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const f of FIELDS) {
      if (body[f] === undefined) continue;
      values.push(String(body[f]).trim());
      sets.push(`${f} = $${values.length}`);
    }
    if (!sets.length) return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });

    sets.push(`updated_at = NOW()`);
    await query(
      `INSERT INTO org_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    );
    await query(`UPDATE org_settings SET ${sets.join(", ")} WHERE id = 1`, values);

    await writeAudit({ user, moduleKey: "system", action: "แก้ไขข้อมูลหน่วยงาน" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update org failed:", err);
    return NextResponse.json({ error: "บันทึกข้อมูลหน่วยงานไม่สำเร็จ" }, { status: 500 });
  }
}
