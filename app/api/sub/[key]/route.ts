import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSubTableByKey } from "@/lib/subtables";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { createSub, listSub, subLabel, validateSub } from "@/lib/subrecords";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * key ในเส้นทางคือ "<moduleKey>~<slug>" (ใช้ ~ แทน / เพราะอยู่ใน path segment เดียว)
 */
function parseKey(raw: string): string {
  return decodeURIComponent(raw).replace("~", "/");
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await ctx.params;
  const def = getSubTableByKey(parseKey(rawKey));

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!def) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });

  if (!canAccessModule(user.role, def.moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงระบบงานนี้" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const result = await listSub(def, {
      search: url.searchParams.get("search") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });

    return NextResponse.json({
      ...result,
      canWrite: canWriteModule(user.role, def.moduleKey),
    });
  } catch (err) {
    console.error(`list sub ${def.key} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await ctx.params;
  const def = getSubTableByKey(parseKey(rawKey));

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!def) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, def.moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เพิ่มข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const errors = validateSub(def, body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" • ") }, { status: 400 });
    }

    const row = await createSub(def, body, user.username);
    await writeAudit({
      user,
      moduleKey: def.moduleKey,
      action: `เพิ่ม${def.label}`,
      detail: subLabel(def, row),
      recordId: typeof row.id === "number" ? row.id : null,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    console.error(`create sub ${def.key} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
