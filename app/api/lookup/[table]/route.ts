import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertIdent, query } from "@/lib/db";
import { LOOKUP_WHITELIST } from "@/lib/subtables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/lookup/[table] — ตัวเลือกสำหรับ dropdown ที่ดึงจากตารางอื่น
 *
 * รับเฉพาะตารางที่อยู่ใน LOOKUP_WHITELIST เท่านั้น
 * และคืนแค่ id กับข้อความที่แสดง ไม่คืนข้อมูลอื่นออกไป
 */
export async function GET(_req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const config = Object.prototype.hasOwnProperty.call(LOOKUP_WHITELIST, table)
    ? LOOKUP_WHITELIST[table]
    : null;
  if (!config) return NextResponse.json({ error: "ไม่อนุญาตให้ดึงข้อมูลตารางนี้" }, { status: 403 });

  try {
    const rows = await query<{ id: number; label: string }>(
      `SELECT id, (${config.labelExpr}) AS label
       FROM ${assertIdent(table)}
       ORDER BY ${config.orderBy}
       LIMIT 500`,
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error(`lookup ${table} failed:`, err);
    return NextResponse.json({ error: "อ่านตัวเลือกไม่สำเร็จ" }, { status: 500 });
  }
}
