import { query, queryOne } from "./db";

/**
 * ระบบเคลื่อนไหวสต๊อกยา/วัคซีน
 *
 * ยอดคงเหลือคำนวณจากรายการรับ-จ่ายจริง (stock_movement) ไม่ใช่ตัวเลขที่พิมพ์ทับ
 * จึงตรวจสอบย้อนหลังได้ และออก Stock Card กับ รบ.301 ได้ตรงตามระเบียบ
 *
 * การจ่ายใช้หลัก FEFO (First Expired, First Out) — จ่ายล็อตที่หมดอายุก่อนเสมอ
 */

export type StockKind = "drug" | "vaccine";

export const MOVE_TYPES = {
  รับเข้า: "in",
  จ่ายออก: "out",
  โอนคลัง: "transfer",
  ปรับปรุงยอด: "adjust",
  ตัดหมดอายุ: "expired",
  ชำรุด: "damaged",
} as const;

export const IN_TYPES = ["รับเข้า"];
export const OUT_TYPES = ["จ่ายออก", "ตัดหมดอายุ", "ชำรุด"];

export interface ItemBalance {
  id: number;
  code: string;
  generic_name: string;
  trade_name: string | null;
  unit: string | null;
  min_qty: number;
  balance: number;
  nearest_expiry: string | null;
  days_to_expiry: number | null;
  lot_count: number;
  below_min: boolean;
  expiring_soon: boolean;
  expired: boolean;
}

/** ยอดคงเหลือรวมทุกล็อต ต่อรายการ */
export async function getBalances(kind: StockKind, search?: string): Promise<ItemBalance[]> {
  const values: unknown[] = [kind];
  let where = `WHERE i.kind = $1 AND i.is_active`;

  if (search?.trim()) {
    values.push(`%${search.trim()}%`);
    where += ` AND (i.code ILIKE $2 OR i.generic_name ILIKE $2 OR COALESCE(i.trade_name,'') ILIKE $2)`;
  }

  const rows = await query<{
    id: number;
    code: string;
    generic_name: string;
    trade_name: string | null;
    unit: string | null;
    min_qty: string | null;
    balance: string;
    nearest_expiry: Date | null;
    lot_count: string;
  }>(
    `SELECT i.id, i.code, i.generic_name, i.trade_name, i.unit, i.min_qty,
            COALESCE(SUM(l.qty), 0)::text AS balance,
            MIN(CASE WHEN l.qty > 0 THEN l.expiry_date END) AS nearest_expiry,
            COUNT(CASE WHEN l.qty > 0 THEN 1 END)::text AS lot_count
     FROM inventory_item i
     LEFT JOIN inventory_lot l ON l.item_id = i.id
     ${where}
     GROUP BY i.id
     ORDER BY i.code`,
    values,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows.map((r) => {
    const balance = Number(r.balance);
    const minQty = Number(r.min_qty ?? 0);
    const expiry = r.nearest_expiry ? new Date(r.nearest_expiry) : null;
    const days = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000) : null;

    return {
      id: r.id,
      code: r.code,
      generic_name: r.generic_name,
      trade_name: r.trade_name,
      unit: r.unit,
      min_qty: minQty,
      balance,
      nearest_expiry: expiry ? expiry.toISOString().slice(0, 10) : null,
      days_to_expiry: days,
      lot_count: Number(r.lot_count),
      below_min: minQty > 0 && balance <= minQty,
      expiring_soon: days !== null && days > 0 && days <= 90,
      expired: days !== null && days <= 0,
    };
  });
}

/** Stock Card — รายการเคลื่อนไหวของรายการเดียว พร้อมยอดคงเหลือต่อเนื่อง */
export async function getStockCard(itemId: number, limit = 500) {
  const item = await queryOne<{
    id: number;
    kind: string;
    code: string;
    generic_name: string;
    trade_name: string | null;
    unit: string | null;
    min_qty: string | null;
  }>(
    `SELECT id, kind, code, generic_name, trade_name, unit, min_qty
     FROM inventory_item WHERE id = $1`,
    [itemId],
  );
  if (!item) return null;

  const movements = await query(
    `SELECT id, move_date, doc_no, move_type, lot_no, expiry_date,
            qty_in, qty_out, balance_after, source_dest, note, created_by, created_at
     FROM stock_movement
     WHERE item_id = $1
     ORDER BY move_date ASC, id ASC
     LIMIT ${Math.min(2000, limit)}`,
    [itemId],
  );

  const lots = await query(
    `SELECT l.id, l.lot_no, l.expiry_date, l.qty, w.name AS warehouse_name
     FROM inventory_lot l LEFT JOIN warehouse w ON w.id = l.warehouse_id
     WHERE l.item_id = $1 AND l.qty > 0
     ORDER BY l.expiry_date ASC NULLS LAST`,
    [itemId],
  );

  return { item, movements, lots };
}

/** ทะเบียนรับ-จ่าย (รบ.301) รายเดือน */
export async function getLedger(kind: StockKind, year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  return query(
    `SELECT i.code, i.generic_name, i.trade_name, i.unit,
            COALESCE(SUM(CASE WHEN m.move_date < $2 THEN m.qty_in - m.qty_out END), 0)::text AS opening,
            COALESCE(SUM(CASE WHEN m.move_date BETWEEN $2 AND $3 THEN m.qty_in END), 0)::text AS received,
            COALESCE(SUM(CASE WHEN m.move_date BETWEEN $2 AND $3 THEN m.qty_out END), 0)::text AS issued,
            COALESCE(SUM(CASE WHEN m.move_date <= $3 THEN m.qty_in - m.qty_out END), 0)::text AS closing
     FROM inventory_item i
     LEFT JOIN stock_movement m ON m.item_id = i.id
     WHERE i.kind = $1 AND i.is_active
     GROUP BY i.id, i.code, i.generic_name, i.trade_name, i.unit
     HAVING COALESCE(SUM(CASE WHEN m.move_date <= $3 THEN m.qty_in - m.qty_out END), 0) <> 0
         OR COALESCE(SUM(CASE WHEN m.move_date BETWEEN $2 AND $3 THEN m.qty_in + m.qty_out END), 0) <> 0
     ORDER BY i.code`,
    [kind, start, end],
  );
}

/** ยอดคงเหลือปัจจุบันของรายการ (ใช้คำนวณ balance_after) */
async function currentBalance(itemId: number): Promise<number> {
  const row = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(qty_in - qty_out), 0)::text AS total
     FROM stock_movement WHERE item_id = $1`,
    [itemId],
  );
  return Number(row?.total ?? 0);
}

export interface MovementInput {
  kind: StockKind;
  itemId: number;
  moveDate: string;
  moveType: string;
  qty: number;
  docNo?: string | null;
  lotNo?: string | null;
  expiryDate?: string | null;
  warehouseId?: number | null;
  sourceDest?: string | null;
  unitPrice?: number | null;
  note?: string | null;
  byUser: string;
}

/**
 * บันทึกการรับเข้า — สร้างล็อตใหม่หรือเพิ่มยอดล็อตเดิมที่ lot_no + วันหมดอายุ ตรงกัน
 */
export async function receiveStock(input: MovementInput): Promise<{ movementId: number; balance: number }> {
  const { itemId, lotNo, expiryDate, warehouseId, qty } = input;
  if (qty <= 0) throw new Error("จำนวนรับเข้าต้องมากกว่า 0");

  let lot = await queryOne<{ id: number }>(
    `SELECT id FROM inventory_lot
     WHERE item_id = $1
       AND COALESCE(lot_no, '') = COALESCE($2, '')
       AND COALESCE(expiry_date::text, '') = COALESCE($3, '')
     LIMIT 1`,
    [itemId, lotNo ?? null, expiryDate ?? null],
  );

  if (lot) {
    await query(`UPDATE inventory_lot SET qty = qty + $1, updated_at = NOW() WHERE id = $2`, [
      qty,
      lot.id,
    ]);
  } else {
    lot = await queryOne<{ id: number }>(
      `INSERT INTO inventory_lot (item_id, warehouse_id, lot_no, expiry_date, qty)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [itemId, warehouseId ?? null, lotNo ?? null, expiryDate ?? null, qty],
    );
  }

  const balance = (await currentBalance(itemId)) + qty;

  const mv = await queryOne<{ id: number }>(
    `INSERT INTO stock_movement
      (kind, move_date, doc_no, move_type, item_id, lot_id, lot_no, expiry_date,
       warehouse_id, qty_in, balance_after, unit_price, source_dest, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      input.kind,
      input.moveDate,
      input.docNo ?? null,
      input.moveType,
      itemId,
      lot!.id,
      lotNo ?? null,
      expiryDate ?? null,
      warehouseId ?? null,
      qty,
      balance,
      input.unitPrice ?? null,
      input.sourceDest ?? null,
      input.note ?? null,
      input.byUser,
    ],
  );

  return { movementId: mv!.id, balance };
}

/**
 * บันทึกการจ่ายออกตามหลัก FEFO
 * ตัดยอดจากล็อตที่หมดอายุก่อนเป็นอันดับแรก และอาจตัดข้ามหลายล็อต
 */
export async function issueStock(
  input: MovementInput,
): Promise<{ movementIds: number[]; balance: number; usedLots: { lotNo: string | null; qty: number }[] }> {
  const { itemId, qty } = input;
  if (qty <= 0) throw new Error("จำนวนจ่ายออกต้องมากกว่า 0");

  const available = await currentBalance(itemId);
  if (qty > available) {
    throw new Error(`ยอดคงเหลือไม่พอ — คงเหลือ ${available} ขอจ่าย ${qty}`);
  }

  // FEFO: เรียงตามวันหมดอายุจากใกล้ที่สุด
  const lots = await query<{ id: number; lot_no: string | null; expiry_date: Date | null; qty: string }>(
    `SELECT id, lot_no, expiry_date, qty FROM inventory_lot
     WHERE item_id = $1 AND qty > 0
     ORDER BY expiry_date ASC NULLS LAST, id ASC`,
    [itemId],
  );

  let remaining = qty;
  let balance = available;
  const movementIds: number[] = [];
  const usedLots: { lotNo: string | null; qty: number }[] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const lotQty = Number(lot.qty);
    const take = Math.min(lotQty, remaining);

    await query(`UPDATE inventory_lot SET qty = qty - $1, updated_at = NOW() WHERE id = $2`, [
      take,
      lot.id,
    ]);

    balance -= take;
    const expiry = lot.expiry_date
      ? new Date(lot.expiry_date).toISOString().slice(0, 10)
      : null;

    const mv = await queryOne<{ id: number }>(
      `INSERT INTO stock_movement
        (kind, move_date, doc_no, move_type, item_id, lot_id, lot_no, expiry_date,
         warehouse_id, qty_out, balance_after, unit_price, source_dest, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        input.kind,
        input.moveDate,
        input.docNo ?? null,
        input.moveType,
        itemId,
        lot.id,
        lot.lot_no,
        expiry,
        input.warehouseId ?? null,
        take,
        balance,
        input.unitPrice ?? null,
        input.sourceDest ?? null,
        input.note ?? null,
        input.byUser,
      ],
    );

    movementIds.push(mv!.id);
    usedLots.push({ lotNo: lot.lot_no, qty: take });
    remaining -= take;
  }

  return { movementIds, balance, usedLots };
}

/** รายการที่ต้องเฝ้าระวัง — ใกล้หมดอายุ / หมดอายุแล้ว / ต่ำกว่าจุดสั่งซื้อ */
export async function getAlerts(kind: StockKind) {
  const balances = await getBalances(kind);

  const lots = await query<{
    item_id: number;
    code: string;
    generic_name: string;
    lot_no: string | null;
    expiry_date: Date | null;
    qty: string;
    unit: string | null;
  }>(
    `SELECT l.item_id, i.code, i.generic_name, l.lot_no, l.expiry_date, l.qty::text, i.unit
     FROM inventory_lot l JOIN inventory_item i ON i.id = l.item_id
     WHERE i.kind = $1 AND l.qty > 0 AND l.expiry_date IS NOT NULL
       AND l.expiry_date <= CURRENT_DATE + 90
     ORDER BY l.expiry_date ASC`,
    [kind],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    belowMin: balances.filter((b) => b.below_min),
    expiringLots: lots.map((l) => {
      const exp = l.expiry_date ? new Date(l.expiry_date) : null;
      const days = exp ? Math.ceil((exp.getTime() - today.getTime()) / 86_400_000) : null;
      return {
        item_id: l.item_id,
        code: l.code,
        generic_name: l.generic_name,
        lot_no: l.lot_no,
        expiry_date: exp ? exp.toISOString().slice(0, 10) : null,
        qty: Number(l.qty),
        unit: l.unit,
        days_to_expiry: days,
        expired: days !== null && days <= 0,
      };
    }),
  };
}
