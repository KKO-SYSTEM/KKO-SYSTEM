import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canWriteModule } from "@/lib/permissions";
import { IN_TYPES, OUT_TYPES, issueStock, receiveStock, type StockKind } from "@/lib/stock";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_OF: Record<string, string> = { drug: "pharmacy", vaccine: "vaccine" };

/**
 * POST /api/stock/[kind]/movement — บันทึกรับเข้า / จ่ายออก / ตัดหมดอายุ / ชำรุด
 * การจ่ายออกใช้หลัก FEFO ตัดล็อตที่หมดอายุก่อนอัตโนมัติ
 */
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await ctx.params;
  if (rawKind !== "drug" && rawKind !== "vaccine") {
    return NextResponse.json({ error: "ประเภทคลังไม่ถูกต้อง" }, { status: 400 });
  }
  const kind = rawKind as StockKind;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canWriteModule(user.role, MODULE_OF[kind])) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์บันทึกรายการในคลังนี้" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const itemId = Number(body.item_id);
    const qty = Number(body.qty);
    const moveType = body.move_type ?? "";
    const moveDate = body.move_date || new Date().toISOString().slice(0, 10);

    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "กรุณาระบุรายการและจำนวนให้ถูกต้อง" }, { status: 400 });
    }
    if (![...IN_TYPES, ...OUT_TYPES].includes(moveType)) {
      return NextResponse.json({ error: "ประเภทรายการไม่ถูกต้อง" }, { status: 400 });
    }

    const item = await queryOne<{ generic_name: string; kind: string; unit: string | null }>(
      `SELECT generic_name, kind, unit FROM inventory_item WHERE id = $1`,
      [itemId],
    );
    if (!item) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });
    if (item.kind !== kind) {
      return NextResponse.json({ error: "รายการนี้ไม่ได้อยู่ในคลังที่เลือก" }, { status: 400 });
    }

    const base = {
      kind,
      itemId,
      moveDate,
      moveType,
      qty,
      docNo: body.doc_no || null,
      lotNo: body.lot_no || null,
      expiryDate: body.expiry_date || null,
      warehouseId: body.warehouse_id ? Number(body.warehouse_id) : null,
      sourceDest: body.source_dest || null,
      unitPrice: body.unit_price ? Number(body.unit_price) : null,
      note: body.note || null,
      byUser: user.username,
    };

    if (IN_TYPES.includes(moveType)) {
      if (!base.expiryDate) {
        return NextResponse.json({ error: "กรุณาระบุวันหมดอายุของล็อตที่รับเข้า" }, { status: 400 });
      }
      const result = await receiveStock(base);
      await writeAudit({
        user,
        moduleKey: MODULE_OF[kind],
        action: `สต๊อก: ${moveType}`,
        detail: `${item.generic_name} จำนวน ${qty} ${item.unit ?? ""} คงเหลือ ${result.balance}`,
        recordId: itemId,
      });
      return NextResponse.json({ ok: true, balance: result.balance });
    }

    const result = await issueStock(base);
    await writeAudit({
      user,
      moduleKey: MODULE_OF[kind],
      action: `สต๊อก: ${moveType}`,
      detail:
        `${item.generic_name} จำนวน ${qty} ${item.unit ?? ""} คงเหลือ ${result.balance}` +
        ` (ตัดล็อต ${result.usedLots.map((l) => `${l.lotNo ?? "-"}×${l.qty}`).join(", ")})`,
      recordId: itemId,
    });
    return NextResponse.json({ ok: true, balance: result.balance, usedLots: result.usedLots });
  } catch (err) {
    console.error("stock movement failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกรายการไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
