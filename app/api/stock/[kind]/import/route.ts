import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { canWriteModule } from "@/lib/permissions";
import type { StockKind } from "@/lib/stock";
import {
  commitImport,
  createMissingItems,
  matchLines,
  parsePastedText,
  type ImportLine,
} from "@/lib/invoice-import";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_OF: Record<string, string> = { drug: "pharmacy", vaccine: "vaccine" };

/**
 * GET  /api/stock/[kind]/import — คลังที่รับเข้าได้
 * POST /api/stock/[kind]/import — mode: "preview" ตรวจการจับคู่ | "commit" รับเข้าสต๊อกจริง
 */

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (kind !== "drug" && kind !== "vaccine") {
    return NextResponse.json({ error: "ประเภทคลังไม่ถูกต้อง" }, { status: 400 });
  }

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const warehouses = await query(
    `SELECT id, name, is_main FROM warehouse WHERE kind = $1 ORDER BY is_main DESC, name`,
    [kind],
  );
  return NextResponse.json({
    warehouses,
    canWrite: canWriteModule(user.role, MODULE_OF[kind]),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await ctx.params;
  if (rawKind !== "drug" && rawKind !== "vaccine") {
    return NextResponse.json({ error: "ประเภทคลังไม่ถูกต้อง" }, { status: 400 });
  }
  const kind = rawKind as StockKind;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canWriteModule(user.role, MODULE_OF[kind])) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์รับของเข้าคลังนี้" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      mode?: string;
      text?: string;
      lines?: ImportLine[];
      createMissing?: boolean;
      doc_no?: string;
      move_date?: string;
      source_dest?: string;
      warehouse_id?: string | number;
      note?: string;
    };

    const rawLines: ImportLine[] =
      Array.isArray(body.lines) && body.lines.length > 0
        ? body.lines
        : parsePastedText(String(body.text ?? ""));

    if (rawLines.length === 0) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลที่นำเข้า — กรุณาวางข้อมูลจาก Excel หรือเลือกไฟล์ CSV" },
        { status: 400 },
      );
    }
    if (rawLines.length > 500) {
      return NextResponse.json({ error: "นำเข้าได้ครั้งละไม่เกิน 500 บรรทัด" }, { status: 400 });
    }

    const matched = await matchLines(kind, rawLines);

    if (body.mode !== "commit") {
      return NextResponse.json({
        lines: matched,
        ready: matched.filter((l) => l.errors.length === 0).length,
        problems: matched.filter((l) => l.errors.length > 0).length,
      });
    }

    let created = 0;
    if (body.createMissing) {
      created = await createMissingItems(kind, matched, user.username);
    }

    const stillBad = matched.filter((l) => l.errors.length > 0);
    if (stillBad.length > 0) {
      return NextResponse.json(
        {
          error: `ยังมี ${stillBad.length} บรรทัดที่นำเข้าไม่ได้ — แก้ไขก่อนแล้วลองใหม่`,
          lines: matched,
        },
        { status: 400 },
      );
    }

    const header = {
      docNo: body.doc_no || null,
      moveDate: body.move_date || new Date().toISOString().slice(0, 10),
      sourceDest: body.source_dest || "รับจาก รพ.แม่ข่าย",
      warehouseId: body.warehouse_id ? Number(body.warehouse_id) : null,
      note: body.note || null,
    };

    const result = await commitImport(kind, header, matched, user.username);

    await writeAudit({
      user,
      moduleKey: MODULE_OF[kind],
      action: "นำเข้า Invoice",
      detail:
        `เลขที่ ${header.docNo ?? "-"} วันที่ ${header.moveDate} — รับเข้า ${result.received} รายการ ` +
        `รวม ${result.totalQty} หน่วย` +
        (created > 0 ? ` (สร้างรายการใหม่ ${created} รายการ)` : ""),
    });

    return NextResponse.json({ ok: true, ...result, created });
  } catch (err) {
    console.error("invoice import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "นำเข้าข้อมูลไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
