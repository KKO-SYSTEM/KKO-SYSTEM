import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canWriteModule } from "@/lib/permissions";
import {
  deleteRecord,
  getRecord,
  recordLabel,
  updateRecord,
  validate,
  writeHistory,
} from "@/lib/records";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ module: string; id: string }> };

/** PUT /api/records/[module]/[id] — แก้ไขรายการ */
export async function PUT(req: Request, ctx: Ctx) {
  const { module: moduleKey, id: rawId } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const mod = getModule(moduleKey);
  if (!mod) return NextResponse.json({ error: "ไม่พบระบบงานที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const errors = validate(mod, body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" • ") }, { status: 400 });
    }

    // อ่านค่าเดิมไว้เทียบ เพื่อเก็บประวัติการแก้ไขรายฟิลด์
    const before = await getRecord(mod, id);
    if (!before) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });

    const row = await updateRecord(mod, id, body, user.username);
    if (!row) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });

    await writeHistory(mod, id, before, row, user.username);
    await writeAudit({
      user,
      moduleKey,
      action: "แก้ไขรายการ",
      detail: recordLabel(mod, row),
      recordId: id,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    console.error(`update ${moduleKey} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "แก้ไขข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

/** DELETE /api/records/[module]/[id] — ลบรายการ */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { module: moduleKey, id: rawId } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const mod = getModule(moduleKey);
  if (!mod) return NextResponse.json({ error: "ไม่พบระบบงานที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    // อ่านชื่อรายการไว้ก่อนลบ เพื่อบันทึกลง Audit Log ให้อ่านรู้เรื่อง
    const existing = await getRecord(mod, id);
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการลบ" }, { status: 404 });

    const label = recordLabel(mod, existing);
    await deleteRecord(mod, id);
    await writeAudit({ user, moduleKey, action: "ลบรายการ", detail: label, recordId: id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`delete ${moduleKey} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
