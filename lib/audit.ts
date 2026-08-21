import { query } from "./db";
import type { SessionUser } from "./auth";

/**
 * บันทึก Audit Log — เรียกทุกครั้งที่มีการเปลี่ยนแปลงข้อมูล
 * ตั้งใจไม่ throw error ออกไป เพราะไม่ควรทำให้การบันทึกข้อมูลหลักล้มเหลว
 */
export async function writeAudit(params: {
  user: SessionUser | null;
  moduleKey: string;
  action: string;
  detail?: string;
  recordId?: number | null;
}): Promise<void> {
  const { user, moduleKey, action, detail, recordId } = params;
  try {
    await query(
      `INSERT INTO audit_log (user_id, username, full_name, role, module_key, action, detail, record_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user?.id ?? null,
        user?.username ?? null,
        user?.fullName ?? null,
        user?.role ?? null,
        moduleKey,
        action,
        detail ?? null,
        recordId ?? null,
      ],
    );
  } catch (err) {
    console.error("writeAudit failed:", err);
  }
}
