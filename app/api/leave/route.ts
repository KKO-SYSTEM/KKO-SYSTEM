import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { fiscalYearOf } from "@/lib/leave-types";
import { calcLeaveDays, nextLeaveDocNo, validateLeave } from "@/lib/leave";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/leave — รายการใบลา */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canAccessModule(user.role, "personnel")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงระบบบุคลากร" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const fiscalYear = Number(url.searchParams.get("fiscalYear")) || fiscalYearOf(new Date());
    const status = url.searchParams.get("status") || "";
    const personnelId = Number(url.searchParams.get("personnelId")) || 0;

    const values: unknown[] = [fiscalYear];
    let where = `WHERE lr.fiscal_year = $1`;

    if (status) {
      values.push(status);
      where += ` AND lr.status = $${values.length}`;
    }
    if (personnelId) {
      values.push(personnelId);
      where += ` AND lr.personnel_id = $${values.length}`;
    }

    const rows = await query(
      `SELECT lr.*,
              TRIM(CONCAT(p.prefix, p.first_name, ' ', p.last_name)) AS personnel_name,
              p.position AS personnel_position
       FROM leave_request lr
       JOIN personnel p ON p.id = lr.personnel_id
       ${where}
       ORDER BY lr.start_date DESC, lr.id DESC
       LIMIT 500`,
      values,
    );

    return NextResponse.json({
      rows,
      fiscalYear,
      canWrite: canWriteModule(user.role, "personnel"),
    });
  } catch (err) {
    console.error("list leave failed:", err);
    return NextResponse.json({ error: "อ่านข้อมูลใบลาไม่สำเร็จ" }, { status: 500 });
  }
}

/** POST /api/leave — สร้างใบลาใหม่ */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canWriteModule(user.role, "personnel")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์สร้างใบลา" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const personnelId = Number(body.personnel_id);
    const leaveType = body.leave_type ?? "";
    const startDate = body.start_date ?? "";
    const endDate = body.end_date ?? "";

    if (!personnelId || !leaveType || !startDate || !endDate) {
      return NextResponse.json(
        { error: "กรุณากรอก ผู้ลา ประเภทการลา และช่วงวันที่ให้ครบ" },
        { status: 400 },
      );
    }

    const fiscalYear = fiscalYearOf(new Date(startDate));
    const totalDays = await calcLeaveDays(startDate, endDate, fiscalYear);

    const { errors, warnings } = await validateLeave({
      personnelId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      writtenDate: body.written_date || null,
    });
    if (errors.length) return NextResponse.json({ error: errors.join(" • ") }, { status: 400 });

    const docNo = await nextLeaveDocNo(fiscalYear);

    const rows = await query<{ id: number }>(
      `INSERT INTO leave_request
        (doc_no, personnel_id, leave_type, fiscal_year, written_date, start_date, end_date,
         total_days, reason, contact_address, contact_phone, substitute_name,
         last_leave_type, last_leave_from, last_leave_to, last_leave_days,
         status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',$17,$17)
       RETURNING id`,
      [
        docNo,
        personnelId,
        leaveType,
        fiscalYear,
        body.written_date || null,
        startDate,
        endDate,
        totalDays,
        body.reason || null,
        body.contact_address || null,
        body.contact_phone || null,
        body.substitute_name || null,
        body.last_leave_type || null,
        body.last_leave_from || null,
        body.last_leave_to || null,
        body.last_leave_days ? Number(body.last_leave_days) : null,
        user.username,
      ],
    );

    await writeAudit({
      user,
      moduleKey: "personnel",
      action: "สร้างใบลา",
      detail: `${docNo} • ${totalDays} วัน`,
      recordId: rows[0].id,
    });

    return NextResponse.json({ ok: true, id: rows[0].id, docNo, totalDays, warnings });
  } catch (err) {
    console.error("create leave failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกใบลาไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
