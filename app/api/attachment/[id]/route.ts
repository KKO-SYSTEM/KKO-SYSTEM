import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { mimeFor, moduleOfRefKey, refLabel } from "@/lib/attachments";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface AttachmentRow {
  id: number;
  ref_key: string | null;
  module_key: string;
  record_id: number;
  file_name: string;
  mime_type: string | null;
  content: Buffer;
}

/** GET /api/attachment/[id] — ดาวน์โหลด (หรือเปิดดู) ไฟล์แนบ */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const row = await queryOne<AttachmentRow>(
    `SELECT id, ref_key, module_key, record_id, file_name, mime_type, content
     FROM attachment WHERE id = $1`,
    [id],
  );
  if (!row) return NextResponse.json({ error: "ไม่พบไฟล์แนบ" }, { status: 404 });

  const moduleKey = moduleOfRefKey(row.ref_key ?? row.module_key) ?? row.module_key;
  if (!canAccessModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้" }, { status: 403 });
  }

  const body = new Uint8Array(row.content);
  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeFor(row.file_name, row.mime_type),
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** DELETE /api/attachment/[id] — ลบไฟล์แนบ */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const row = await queryOne<{
    ref_key: string | null;
    module_key: string;
    record_id: number;
    file_name: string;
  }>(`SELECT ref_key, module_key, record_id, file_name FROM attachment WHERE id = $1`, [id]);
  if (!row) return NextResponse.json({ error: "ไม่พบไฟล์แนบ" }, { status: 404 });

  const refKey = row.ref_key ?? row.module_key;
  const moduleKey = moduleOfRefKey(refKey) ?? row.module_key;
  if (!canWriteModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบไฟล์แนบในระบบงานนี้" }, { status: 403 });
  }

  await query(`DELETE FROM attachment WHERE id = $1`, [id]);
  await writeAudit({
    user,
    moduleKey,
    action: "ลบไฟล์แนบ",
    detail: `${refLabel(refKey)} #${row.record_id} — ${row.file_name}`,
    recordId: row.record_id,
  });

  return NextResponse.json({ ok: true });
}
