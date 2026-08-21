import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { fiscalYearOf } from "@/lib/leave-types";
import { getLeaveQuota } from "@/lib/leave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/leave/quota — สิทธิ์วันลาคงเหลือ (รายคน หรือทั้งหน่วยงาน) */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canAccessModule(user.role, "personnel")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงระบบบุคลากร" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const fiscalYear = Number(url.searchParams.get("fiscalYear")) || fiscalYearOf(new Date());
    const personnelId = Number(url.searchParams.get("personnelId")) || 0;

    if (personnelId) {
      const quotas = await getLeaveQuota(personnelId, fiscalYear);
      return NextResponse.json({ fiscalYear, personnelId, quotas });
    }

    /* สรุปทั้งหน่วยงาน: จำนวนวันลาที่อนุมัติแล้ว แยกตามคนและประเภท */
    const people = await query<{ id: number; name: string; position: string | null }>(
      `SELECT id, TRIM(CONCAT(prefix, first_name, ' ', last_name)) AS name, position
       FROM personnel WHERE status <> 'ย้าย/ลาออก' ORDER BY first_name`,
    );

    const usage = await query<{ personnel_id: number; leave_type: string; total: string }>(
      `SELECT personnel_id, leave_type, SUM(total_days)::text AS total
       FROM leave_request
       WHERE fiscal_year = $1 AND status = 'approved'
       GROUP BY personnel_id, leave_type`,
      [fiscalYear],
    );

    const summary = people.map((p) => {
      const byType: Record<string, number> = {};
      let totalDays = 0;
      for (const u of usage.filter((x) => x.personnel_id === p.id)) {
        const v = Number(u.total);
        byType[u.leave_type] = v;
        totalDays += v;
      }
      return { ...p, byType, totalDays };
    });

    return NextResponse.json({ fiscalYear, summary });
  } catch (err) {
    console.error("leave quota failed:", err);
    return NextResponse.json({ error: "อ่านข้อมูลสิทธิ์วันลาไม่สำเร็จ" }, { status: 500 });
  }
}
