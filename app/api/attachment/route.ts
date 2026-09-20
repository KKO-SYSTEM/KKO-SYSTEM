import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import {
  MAX_FILE_BYTES,
  formatBytes,
  isAllowedFile,
  mimeFor,
  moduleOfRefKey,
  refLabel,
} from "@/lib/attachments";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/attachment?refKey=...&recordId=...  — รายการไฟล์แนบ (ไม่ส่งตัวไฟล์)
 * POST /api/attachment                           — อัปโหลดไฟล์แนบ (multipart/form-data)
 */

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const url = new URL(req.url);
  const refKey = url.searchParams.get("refKey") ?? "";
  const recordId = Number(url.searchParams.get("recordId"));

  const moduleKey = moduleOfRefKey(refKey);
  if (!moduleKey || !Number.isInteger(recordId) || recordId <= 0) {
    return NextResponse.json({ error: "พารามิเตอร์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!canAccessModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงระบบงานนี้" }, { status: 403 });
  }

  try {
    const rows = await query(
      `SELECT id, file_name, mime_type, size_bytes, uploaded_by, uploaded_at
       FROM attachment
       WHERE ref_key = $1 AND record_id = $2
       ORDER BY uploaded_at DESC, id DESC`,
      [refKey, recordId],
    );
    return NextResponse.json({ rows, canWrite: canWriteModule(user.role, moduleKey) });
  } catch (err) {
    console.error("list attachment failed:", err);
    return NextResponse.json({ error: "อ่านรายการไฟล์แนบไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    const form = await req.formData();
    const refKey = String(form.get("refKey") ?? "");
    const recordId = Number(form.get("recordId"));
    const file = form.get("file");

    const moduleKey = moduleOfRefKey(refKey);
    if (!moduleKey || !Number.isInteger(recordId) || recordId <= 0) {
      return NextResponse.json({ error: "พารามิเตอร์ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!canWriteModule(user.role, moduleKey)) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์แนบไฟล์ในระบบงานนี้" }, { status: 403 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์ที่ต้องการแนบ" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `ไฟล์ใหญ่เกินไป (${formatBytes(file.size)}) — จำกัดไม่เกิน ${formatBytes(MAX_FILE_BYTES)}` },
        { status: 400 },
      );
    }
    if (!isAllowedFile(file.name)) {
      return NextResponse.json(
        { error: "ชนิดไฟล์นี้ไม่รองรับ — รองรับเอกสาร Word/Excel/PowerPoint/PDF รูปภาพ และ zip" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const row = await queryOne<{ id: number }>(
      `INSERT INTO attachment
        (module_key, ref_key, record_id, file_name, mime_type, size_bytes, content, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        moduleKey,
        refKey,
        recordId,
        file.name,
        mimeFor(file.name, file.type),
        buffer.length,
        buffer,
        user.username,
      ],
    );

    await writeAudit({
      user,
      moduleKey,
      action: "แนบไฟล์",
      detail: `${refLabel(refKey)} #${recordId} — ${file.name} (${formatBytes(buffer.length)})`,
      recordId,
    });

    return NextResponse.json({ ok: true, id: row?.id });
  } catch (err) {
    console.error("upload attachment failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
