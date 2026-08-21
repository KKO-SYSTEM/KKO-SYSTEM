import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canApprove, canWriteModule } from "@/lib/permissions";
import { query } from "@/lib/db";
import {
  addRequisitionItem,
  approveRequisition,
  deleteRequisitionItem,
  getRequisition,
  getRequisitionItems,
  issueRequisition,
  rejectRequisition,
  updateRequisitionItem,
} from "@/lib/requisition";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** ใบเบิกยา = โมดูล pharmacy, ใบเบิกวัคซีน = โมดูล vaccine */
function moduleOf(kind: string): string {
  return kind === "vaccine" ? "vaccine" : "pharmacy";
}

/** GET — หัวใบเบิก + รายการในใบ + รายการยาที่เลือกได้ */
export async function GET(_req: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสใบเบิกไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const req = await getRequisition(id);
    if (!req) return NextResponse.json({ error: "ไม่พบใบเบิก" }, { status: 404 });

    const moduleKey = moduleOf(req.kind);
    const items = await getRequisitionItems(id);

    /* รายการยา/วัคซีนที่เลือกใส่ในใบได้ พร้อมยอดคงเหลือ */
    const catalog = await query(
      `SELECT i.id, i.code, COALESCE(i.trade_name, i.generic_name) AS name, i.unit,
              COALESCE((SELECT SUM(qty) FROM inventory_lot WHERE item_id = i.id), 0)::float AS balance
       FROM inventory_item i
       WHERE i.kind = $1 AND i.is_active = TRUE
       ORDER BY i.code`,
      [req.kind],
    );

    return NextResponse.json({
      requisition: req,
      items,
      catalog,
      canWrite: canWriteModule(user.role, moduleKey),
      canApprove: canApprove(user.role),
    });
  } catch (err) {
    console.error("get requisition failed:", err);
    return NextResponse.json({ error: "อ่านข้อมูลใบเบิกไม่สำเร็จ" }, { status: 500 });
  }
}

/**
 * POST — การกระทำกับใบเบิก
 * action: add-item | update-item | delete-item | approve | reject | issue
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสใบเบิกไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const req = await getRequisition(id);
    if (!req) return NextResponse.json({ error: "ไม่พบใบเบิก" }, { status: 404 });

    const moduleKey = moduleOf(req.kind);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    const needWrite = ["add-item", "update-item", "delete-item", "issue"];
    if (needWrite.includes(action) && !canWriteModule(user.role, moduleKey)) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์แก้ไขใบเบิกนี้" }, { status: 403 });
    }
    if ((action === "approve" || action === "reject") && !canApprove(user.role)) {
      return NextResponse.json(
        { error: "เฉพาะผู้บริหารหรือผู้ดูแลระบบเท่านั้นที่อนุมัติได้" },
        { status: 403 },
      );
    }

    /* ใบที่จ่ายของแล้วห้ามแก้รายการ เพื่อให้ตรงกับสต๊อกที่ตัดไปจริง */
    if (needWrite.includes(action) && action !== "issue" && req.status === "issued") {
      return NextResponse.json(
        { error: "ใบเบิกนี้จ่ายของไปแล้ว ไม่สามารถแก้ไขรายการได้" },
        { status: 400 },
      );
    }

    switch (action) {
      case "add-item": {
        const itemId = Number(body.itemId);
        const qty = Number(body.qty);
        if (!Number.isInteger(itemId) || itemId <= 0) {
          return NextResponse.json({ error: "กรุณาเลือกรายการ" }, { status: 400 });
        }
        await addRequisitionItem(id, itemId, qty, body.note ? String(body.note) : null);
        await writeAudit({
          user,
          moduleKey,
          action: "เพิ่มรายการในใบเบิก",
          detail: `ใบเบิก ${req.doc_no ?? id}`,
          recordId: id,
        });
        break;
      }

      case "update-item": {
        await updateRequisitionItem(
          Number(body.itemRowId),
          Number(body.qty),
          body.note ? String(body.note) : null,
        );
        await writeAudit({
          user,
          moduleKey,
          action: "แก้ไขรายการในใบเบิก",
          detail: `ใบเบิก ${req.doc_no ?? id}`,
          recordId: id,
        });
        break;
      }

      case "delete-item": {
        await deleteRequisitionItem(Number(body.itemRowId));
        await writeAudit({
          user,
          moduleKey,
          action: "ลบรายการในใบเบิก",
          detail: `ใบเบิก ${req.doc_no ?? id}`,
          recordId: id,
        });
        break;
      }

      case "approve": {
        await approveRequisition(id, user.username, user.fullName);
        await writeAudit({
          user,
          moduleKey,
          action: "อนุมัติใบเบิก",
          detail: `ใบเบิก ${req.doc_no ?? id}`,
          recordId: id,
        });
        break;
      }

      case "reject": {
        await rejectRequisition(
          id,
          user.username,
          user.fullName,
          body.reason ? String(body.reason) : null,
        );
        await writeAudit({
          user,
          moduleKey,
          action: "ไม่อนุมัติใบเบิก",
          detail: `ใบเบิก ${req.doc_no ?? id}`,
          recordId: id,
        });
        break;
      }

      case "issue": {
        const result = await issueRequisition(
          id,
          user.username,
          body.issuerName ? String(body.issuerName) : user.fullName,
          body.receiverName ? String(body.receiverName) : null,
        );
        await writeAudit({
          user,
          moduleKey,
          action: "จ่ายของตามใบเบิก (ตัดสต๊อก)",
          detail: `ใบเบิก ${req.doc_no ?? id} — ${result.issued} รายการ รวม ${result.totalQty}`,
          recordId: id,
        });
        break;
      }

      default:
        return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("requisition action failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
