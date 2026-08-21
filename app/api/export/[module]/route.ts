import { requireUser } from "@/lib/auth";
import { getModule } from "@/lib/modules";
import { canAccessModule } from "@/lib/permissions";
import { allRecords } from "@/lib/records";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString().slice(0, 10);
  } else {
    text = String(value);
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** GET /api/export/[module] — ดาวน์โหลด CSV (เปิดใน Excel ได้ รองรับภาษาไทย) */
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
    const search = new URL(req.url).searchParams.get("search") ?? undefined;
    const rows = await allRecords(mod, search);

    const header = mod.fields.map((f) => csvCell(f.label)).join(",");
    const lines = rows.map((row) => mod.fields.map((f) => csvCell(row[f.key])).join(","));

    // BOM ข้างหน้าเพื่อให้ Excel อ่านภาษาไทยถูกต้อง
    const csv = "﻿" + [header, ...lines].join("\r\n");

    await writeAudit({
      user,
      moduleKey,
      action: "Export CSV",
      detail: `ส่งออกข้อมูล ${rows.length} รายการ`,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(mod.label)}.csv`,
      },
    });
  } catch (err) {
    console.error(`export ${moduleKey} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ส่งออกข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
