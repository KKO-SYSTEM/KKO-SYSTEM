import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canApprove, canWriteModule } from "@/lib/permissions";
import { LEAVE_STATUS } from "@/lib/leave-types";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/leave/[id] — อนุมัติ / ไม่อนุมัติ / ยกเลิก */
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสใบลาไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { status?: string; comment?: string };
    const status = body.status ?? "";

    if (!Object.keys(LEAVE_STATUS).includes(status)) {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }

    // อนุมัติ/ไม่อนุมัติ ต้องเป็นผู้มีอำนาจอนุมัติเท่านั้น
    if ((status === "approved" || status === "rejected") && !canApprove(user.role)) {
      return NextResponse.json(
        { error: "เฉพาะผู้บริหารหรือผู้ดูแลระบบเท่านั้นที่อนุมัติใบลาได้" },
        { status: 403 },
      );
    }
    if (status === "cancelled" && !canWriteModule(user.role, "personnel") && !canApprove(user.role)) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์ยกเลิกใบลา" }, { status: 403 });
    }

    const existing = await queryOne<{ doc_no: string }>(
      `SELECT doc_no FROM leave_request WHERE id = $1`,
      [id],
    );
    if (!existing) return NextResponse.json({ error: "ไม่พบใบลาที่ระบุ" }, { status: 404 });

    const isDecision = status === "approved" || status === "rejected";
    await query(
      `UPDATE leave_request
       SET status = $1,
           supervisor_comment = COALESCE($2, supervisor_comment),
           approver_name = CASE WHEN $3 THEN $4 ELSE approver_name END,
           approved_at   = CASE WHEN $3 THEN NOW() ELSE approved_at END,
           updated_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [status, body.comment ?? null, isDecision, user.fullName, id],
    );

    await writeAudit({
      user,
      moduleKey: "personnel",
      action: `ใบลา: ${LEAVE_STATUS[status as keyof typeof LEAVE_STATUS]}`,
      detail: existing.doc_no,
      recordId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update leave failed:", err);
    return NextResponse.json({ error: "อัปเดตใบลาไม่สำเร็จ" }, { status: 500 });
  }
}

/** DELETE /api/leave/[id] */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canWriteModule(user.role, "personnel")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบใบลา" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสใบลาไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const rows = await query<{ doc_no: string }>(
      `DELETE FROM leave_request WHERE id = $1 RETURNING doc_no`,
      [id],
    );
    if (!rows.length) return NextResponse.json({ error: "ไม่พบใบลาที่ระบุ" }, { status: 404 });

    await writeAudit({
      user,
      moduleKey: "personnel",
      action: "ลบใบลา",
      detail: rows[0].doc_no,
      recordId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete leave failed:", err);
    return NextResponse.json({ error: "ลบใบลาไม่สำเร็จ" }, { status: 500 });
  }
}
