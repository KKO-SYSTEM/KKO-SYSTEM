import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canViewAudit } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/audit — ประวัติการใช้งานระบบ */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canViewAudit(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบและผู้บริหารเท่านั้น" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));
    const moduleKey = url.searchParams.get("module") || "";
    const search = url.searchParams.get("search")?.trim() || "";

    const values: unknown[] = [];
    const parts: string[] = [];

    if (moduleKey) {
      values.push(moduleKey);
      parts.push(`module_key = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      parts.push(
        `(COALESCE(full_name,'') ILIKE $${values.length} OR COALESCE(action,'') ILIKE $${values.length} OR COALESCE(detail,'') ILIKE $${values.length})`,
      );
    }
    const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log ${where}`,
      values,
    );
    const total = Number(countRow?.count ?? 0);

    const rows = await query(
      `SELECT id, username, full_name, role, module_key, action, detail, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      values,
    );

    return NextResponse.json({ rows, total, page, pageSize });
  } catch (err) {
    console.error("audit failed:", err);
    return NextResponse.json({ error: "อ่าน Audit Log ไม่สำเร็จ" }, { status: 500 });
  }
}
