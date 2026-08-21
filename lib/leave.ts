import { query } from "./db";
import { LEAVE_TYPES, countWorkingDays, fiscalYearOf, fiscalYearRange, getLeaveType } from "./leave-types";

export interface LeaveQuota {
  code: string;
  label: string;
  quotaNote: string;
  maxDays: number | null;
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
  overQuota: boolean;
}

/** วันหยุดราชการในช่วงปีงบประมาณ */
export async function getHolidays(fiscalYear: number): Promise<string[]> {
  const { start, end } = fiscalYearRange(fiscalYear);
  const rows = await query<{ holiday_date: Date }>(
    `SELECT holiday_date FROM holiday WHERE holiday_date BETWEEN $1 AND $2`,
    [start, end],
  );
  return rows.map((r) =>
    r.holiday_date instanceof Date
      ? r.holiday_date.toISOString().slice(0, 10)
      : String(r.holiday_date).slice(0, 10),
  );
}

/** คำนวณจำนวนวันลา (นับเฉพาะวันทำการ หักวันหยุดราชการ) */
export async function calcLeaveDays(
  startDate: string,
  endDate: string,
  fiscalYear: number,
): Promise<number> {
  const holidays = await getHolidays(fiscalYear);
  return countWorkingDays(startDate, endDate, holidays);
}

/**
 * สรุปสิทธิ์วันลาคงเหลือของบุคลากรรายคน ในปีงบประมาณที่ระบุ
 * ไม่นับใบที่ถูกปฏิเสธหรือยกเลิก
 */
export async function getLeaveQuota(
  personnelId: number,
  fiscalYear: number,
  excludeLeaveId?: number,
): Promise<LeaveQuota[]> {
  const params: unknown[] = [personnelId, fiscalYear];
  let extra = "";
  if (excludeLeaveId) {
    params.push(excludeLeaveId);
    extra = ` AND id <> $${params.length}`;
  }

  const rows = await query<{ leave_type: string; status: string; total: string }>(
    `SELECT leave_type, status, COALESCE(SUM(total_days), 0)::text AS total
     FROM leave_request
     WHERE personnel_id = $1 AND fiscal_year = $2
       AND status IN ('pending', 'approved')${extra}
     GROUP BY leave_type, status`,
    params,
  );

  return LEAVE_TYPES.map((t) => {
    const used = Number(
      rows.find((r) => r.leave_type === t.code && r.status === "approved")?.total ?? 0,
    );
    const pending = Number(
      rows.find((r) => r.leave_type === t.code && r.status === "pending")?.total ?? 0,
    );
    const remaining = t.maxDaysPerYear === null ? null : t.maxDaysPerYear - used - pending;

    return {
      code: t.code,
      label: t.label,
      quotaNote: t.quotaNote,
      maxDays: t.maxDaysPerYear,
      usedDays: used,
      pendingDays: pending,
      remainingDays: remaining,
      overQuota: remaining !== null && remaining < 0,
    };
  });
}

/**
 * ตรวจใบลาตามระเบียบสำนักนายกรัฐมนตรีฯ พ.ศ. 2555
 * คืนรายการคำเตือน/ข้อผิดพลาด
 */
export async function validateLeave(params: {
  personnelId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  writtenDate?: string | null;
  excludeLeaveId?: number;
}): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const type = getLeaveType(params.leaveType);
  if (!type) {
    errors.push("ประเภทการลาไม่ถูกต้อง");
    return { errors, warnings };
  }

  if (new Date(params.endDate) < new Date(params.startDate)) {
    errors.push("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา");
  }
  if (params.totalDays <= 0) {
    errors.push("ช่วงวันที่เลือกไม่มีวันทำการ (อาจตรงกับวันหยุดทั้งหมด)");
  }

  // ตรวจสิทธิ์คงเหลือ
  const fiscalYear = fiscalYearOf(new Date(params.startDate));
  const quotas = await getLeaveQuota(params.personnelId, fiscalYear, params.excludeLeaveId);
  const quota = quotas.find((q) => q.code === params.leaveType);

  if (quota && quota.maxDays !== null) {
    const willUse = quota.usedDays + quota.pendingDays + params.totalDays;
    if (willUse > quota.maxDays) {
      errors.push(
        `เกินสิทธิ์ ${type.label} — ใช้ไปแล้ว ${quota.usedDays + quota.pendingDays} วัน ` +
          `ขอลาอีก ${params.totalDays} วัน รวม ${willUse} วัน เกินสิทธิ์ ${type.maxDaysPerYear} วัน`,
      );
    }
  }

  // ลาป่วยตั้งแต่ 30 วันต้องมีใบรับรองแพทย์
  if (params.leaveType === "sick" && params.totalDays >= 30) {
    warnings.push("ลาป่วยตั้งแต่ 30 วันขึ้นไป ต้องแนบใบรับรองแพทย์ตามระเบียบ");
  }

  // ต้องยื่นล่วงหน้า
  if (type.advanceNoticeDays > 0 && params.writtenDate) {
    const written = new Date(params.writtenDate);
    const start = new Date(params.startDate);
    const diffDays = Math.floor((start.getTime() - written.getTime()) / 86_400_000);
    if (diffDays < type.advanceNoticeDays) {
      warnings.push(
        `${type.label} ต้องยื่นใบลาล่วงหน้าอย่างน้อย ${type.advanceNoticeDays} วัน ` +
          `(ยื่นล่วงหน้าเพียง ${diffDays} วัน)`,
      );
    }
  }

  if (type.requiresAttachment && type.attachmentNote) {
    warnings.push(`ต้องแนบเอกสารประกอบ: ${type.attachmentNote}`);
  }

  return { errors, warnings };
}

/** เลขที่ใบลาอัตโนมัติ เช่น ล.0001/2569 */
export async function nextLeaveDocNo(fiscalYear: number): Promise<string> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM leave_request WHERE fiscal_year = $1`,
    [fiscalYear],
  );
  const seq = Number(rows[0]?.count ?? 0) + 1;
  return `ล.${String(seq).padStart(4, "0")}/${fiscalYear}`;
}
