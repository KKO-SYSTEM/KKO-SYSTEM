import { query, queryOne } from "./db";
import { issueStock, type StockKind } from "./stock";

/**
 * ใบเบิกยา / วัคซีน — รายการในใบ และการตัดสต๊อกเมื่อจ่ายของ
 *
 * ขั้นตอนตามระเบียบ: ร่าง → รออนุมัติ → อนุมัติ → จ่ายของ
 * ระบบจะตัดสต๊อกจริงตอน "จ่ายของ" เท่านั้น (ไม่ใช่ตอนอนุมัติ)
 * เพราะของอาจจ่ายไม่ครบตามที่ขอเบิก
 */

export interface ReqItemRow {
  id: number;
  requisition_id: number;
  item_id: number;
  qty_requested: string | number;
  qty_issued: string | number | null;
  note: string | null;
  /* จาก join */
  code?: string;
  item_name?: string;
  unit?: string;
  balance?: number;
}

/** รายการในใบเบิก พร้อมยอดคงเหลือปัจจุบันของแต่ละรายการ */
export async function getRequisitionItems(reqId: number): Promise<ReqItemRow[]> {
  return query<ReqItemRow>(
    `SELECT ri.id, ri.requisition_id, ri.item_id, ri.qty_requested, ri.qty_issued, ri.note,
            i.code, COALESCE(i.trade_name, i.generic_name) AS item_name, i.unit,
            COALESCE((SELECT SUM(qty) FROM inventory_lot WHERE item_id = i.id), 0)::float AS balance
     FROM requisition_item ri
     JOIN inventory_item i ON i.id = ri.item_id
     WHERE ri.requisition_id = $1
     ORDER BY ri.id`,
    [reqId],
  );
}

export async function getRequisition(reqId: number) {
  return queryOne<{
    id: number;
    kind: string;
    doc_no: string | null;
    req_date: Date;
    requester: string | null;
    purpose: string | null;
    status: string;
    approver_name: string | null;
    issuer_name: string | null;
    receiver_name: string | null;
    note: string | null;
  }>(`SELECT * FROM requisition WHERE id = $1`, [reqId]);
}

export async function addRequisitionItem(
  reqId: number,
  itemId: number,
  qty: number,
  note?: string | null,
): Promise<number> {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("จำนวนที่ขอเบิกต้องมากกว่า 0");

  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM requisition_item WHERE requisition_id = $1 AND item_id = $2`,
    [reqId, itemId],
  );
  if (existing) throw new Error("รายการนี้มีอยู่ในใบเบิกแล้ว กรุณาแก้ไขจำนวนแทน");

  const row = await queryOne<{ id: number }>(
    `INSERT INTO requisition_item (requisition_id, item_id, qty_requested, note)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [reqId, itemId, qty, note ?? null],
  );
  return row!.id;
}

export async function updateRequisitionItem(
  itemRowId: number,
  qtyRequested: number,
  note?: string | null,
): Promise<void> {
  if (!Number.isFinite(qtyRequested) || qtyRequested <= 0) {
    throw new Error("จำนวนที่ขอเบิกต้องมากกว่า 0");
  }
  await query(`UPDATE requisition_item SET qty_requested = $1, note = $2 WHERE id = $3`, [
    qtyRequested,
    note ?? null,
    itemRowId,
  ]);
}

export async function deleteRequisitionItem(itemRowId: number): Promise<void> {
  await query(`DELETE FROM requisition_item WHERE id = $1`, [itemRowId]);
}

/**
 * จ่ายของตามใบเบิก — ตัดสต๊อกจริงแบบ FEFO ทีละรายการ
 *
 * ตรวจยอดคงเหลือของทุกรายการก่อนเริ่มตัด ถ้ามีรายการใดไม่พอจะไม่ตัดอะไรเลย
 * เพื่อไม่ให้ใบเบิกถูกจ่ายครึ่ง ๆ กลาง ๆ
 */
export async function issueRequisition(
  reqId: number,
  byUser: string,
  issuerName?: string | null,
  receiverName?: string | null,
): Promise<{ issued: number; totalQty: number }> {
  const req = await getRequisition(reqId);
  if (!req) throw new Error("ไม่พบใบเบิก");
  if (req.status === "issued") throw new Error("ใบเบิกนี้จ่ายของไปแล้ว");
  if (req.status === "rejected") throw new Error("ใบเบิกนี้ไม่ได้รับอนุมัติ");
  if (req.status !== "approved") throw new Error("ต้องอนุมัติใบเบิกก่อนจึงจะจ่ายของได้");

  const items = await getRequisitionItems(reqId);
  if (items.length === 0) throw new Error("ใบเบิกนี้ยังไม่มีรายการ");

  // ตรวจยอดคงเหลือทุกรายการก่อน
  const shortages: string[] = [];
  for (const it of items) {
    const want = Number(it.qty_requested);
    const have = Number(it.balance ?? 0);
    if (want > have) {
      shortages.push(`${it.item_name} (ขอ ${want} ${it.unit ?? ""} คงเหลือ ${have})`);
    }
  }
  if (shortages.length > 0) {
    throw new Error(`ยอดคงเหลือไม่พอ: ${shortages.join(", ")}`);
  }

  let totalQty = 0;
  for (const it of items) {
    const qty = Number(it.qty_requested);
    await issueStock({
      kind: req.kind as StockKind,
      itemId: it.item_id,
      moveDate: new Date().toISOString().slice(0, 10),
      moveType: "จ่ายออก",
      qty,
      docNo: req.doc_no,
      sourceDest: req.requester ? `จ่ายตามใบเบิกของ ${req.requester}` : "จ่ายตามใบเบิก",
      note: `ใบเบิกเลขที่ ${req.doc_no ?? reqId}`,
      byUser,
    });

    await query(`UPDATE requisition_item SET qty_issued = $1 WHERE id = $2`, [qty, it.id]);
    totalQty += qty;
  }

  await query(
    `UPDATE requisition
     SET status = 'issued', issued_at = NOW(),
         issuer_name = COALESCE($2, issuer_name),
         receiver_name = COALESCE($3, receiver_name),
         updated_at = NOW(), updated_by = $4
     WHERE id = $1`,
    [reqId, issuerName ?? null, receiverName ?? null, byUser],
  );

  return { issued: items.length, totalQty };
}

/** อนุมัติใบเบิก */
export async function approveRequisition(
  reqId: number,
  byUser: string,
  approverName: string,
): Promise<void> {
  const req = await getRequisition(reqId);
  if (!req) throw new Error("ไม่พบใบเบิก");
  if (req.status === "issued") throw new Error("ใบเบิกนี้จ่ายของไปแล้ว");

  const items = await getRequisitionItems(reqId);
  if (items.length === 0) throw new Error("ใบเบิกนี้ยังไม่มีรายการ ไม่สามารถอนุมัติได้");

  await query(
    `UPDATE requisition SET status='approved', approver_name=$2, approved_at=NOW(),
       updated_at=NOW(), updated_by=$3 WHERE id=$1`,
    [reqId, approverName, byUser],
  );
}

/** ไม่อนุมัติใบเบิก */
export async function rejectRequisition(
  reqId: number,
  byUser: string,
  approverName: string,
  reason?: string | null,
): Promise<void> {
  const req = await getRequisition(reqId);
  if (!req) throw new Error("ไม่พบใบเบิก");
  if (req.status === "issued") throw new Error("ใบเบิกนี้จ่ายของไปแล้ว ไม่สามารถเปลี่ยนสถานะได้");

  await query(
    `UPDATE requisition SET status='rejected', approver_name=$2, approved_at=NOW(),
       note = COALESCE(NULLIF($3,''), note), updated_at=NOW(), updated_by=$4 WHERE id=$1`,
    [reqId, approverName, reason ?? "", byUser],
  );
}
