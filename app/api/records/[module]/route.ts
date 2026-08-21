import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { createRecord, listRecords, recordLabel, validate } from "@/lib/records";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/records/[module] — ค้นหา + แบ่งหน้า */
export async function GET(req: Request, ctx: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const mod = getModule(moduleKey);
  if (!mod) return NextResponse.json({ error: "ไม่พบระบบงานที่ระบุ" }, { status: 404 });

  if (!canAccessModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงระบบงานนี้" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const result = await listRecords(mod, {
      search: url.searchParams.get("search") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      dir: (url.searchParams.get("dir") as "asc" | "desc") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    });

    return NextResponse.json({ ...result, canWrite: canWriteModule(user.role, moduleKey) });
  } catch (err) {
    console.error(`list ${moduleKey} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

/** POST /api/records/[module] — เพิ่มรายการใหม่ */
export async function POST(req: Request, ctx: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const mod = getModule(moduleKey);
  if (!mod) return NextResponse.json({ error: "ไม่พบระบบงานที่ระบุ" }, { status: 404 });

  if (!canWriteModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เพิ่มข้อมูลในระบบงานนี้" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const errors = validate(mod, body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" • ") }, { status: 400 });
    }

    const row = await createRecord(mod, body, user.username);
    await writeAudit({
      user,
      moduleKey,
      action: "เพิ่มรายการ",
      detail: recordLabel(mod, row),
      recordId: typeof row.id === "number" ? row.id : null,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    console.error(`create ${moduleKey} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
