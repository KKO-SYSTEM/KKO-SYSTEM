import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSubTableByKey } from "@/lib/subtables";
import { canWriteModule } from "@/lib/permissions";
import { deleteSub, getSub, subLabel, updateSub, validateSub } from "@/lib/subrecords";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string; id: string }> };

function parseKey(raw: string): string {
  return decodeURIComponent(raw).replace("~", "/");
}

export async function PUT(req: Request, ctx: Ctx) {
  const { key: rawKey, id: rawId } = await ctx.params;
  const def = getSubTableByKey(parseKey(rawKey));

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!def) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, def.moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const errors = validateSub(def, body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" • ") }, { status: 400 });
    }

    const row = await updateSub(def, id, body, user.username);
    if (!row) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });

    await writeAudit({
      user,
      moduleKey: def.moduleKey,
      action: `แก้ไข${def.label}`,
      detail: subLabel(def, row),
      recordId: id,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    console.error(`update sub ${def.key} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "แก้ไขข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { key: rawKey, id: rawId } = await ctx.params;
  const def = getSubTableByKey(parseKey(rawKey));

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!def) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, def.moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์ลบข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const existing = await getSub(def, id);
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการที่ต้องการลบ" }, { status: 404 });

    const label = subLabel(def, existing);
    await deleteSub(def, id);
    await writeAudit({
      user,
      moduleKey: def.moduleKey,
      action: `ลบ${def.label}`,
      detail: label,
      recordId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`delete sub ${def.key} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ลบข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
