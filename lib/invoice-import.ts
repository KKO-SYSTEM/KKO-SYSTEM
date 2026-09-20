import { query, queryOne } from "./db";
import { receiveStock, type StockKind } from "./stock";

/**
 * นำเข้า Invoice / ใบส่งของจาก รพ.แม่ข่าย
 *
 * รับข้อมูลที่คัดลอกมาจาก Excel (คั่นด้วย Tab) หรือไฟล์ CSV แล้วจับคู่กับรายการในทะเบียนคลัง
 * ก่อนรับเข้าสต๊อกจริง ระบบจะให้ตรวจผลการจับคู่ก่อนเสมอ (ขั้นตรวจสอบ) เพื่อกันของเข้าผิดรายการ
 *
 * ลำดับคอลัมน์ที่รองรับ: รหัส | ชื่อรายการ | เลขที่ล็อต | วันหมดอายุ | จำนวน | ราคาต่อหน่วย
 */

export interface ImportLine {
  code?: string | null;
  name?: string | null;
  lot_no?: string | null;
  expiry_date?: string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  unit?: string | null;
}

export interface MatchedLine {
  lineNo: number;
  code: string | null;
  name: string | null;
  lotNo: string | null;
  expiryDate: string | null;
  qty: number;
  unitPrice: number | null;
  itemId: number | null;
  matchedName: string | null;
  matchedBy: "code" | "name" | null;
  errors: string[];
}

/** แปลงวันที่จากหลายรูปแบบ (2026-12-31, 31/12/2026, 31/12/2569) เป็น ISO */
export function parseDate(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    let year = Number(iso[1]);
    if (year > 2400) year -= 543; // ปี พ.ศ. → ค.ศ.
    return `${year}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year > 2400) year -= 543;
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // เดือน/ปี อย่างเดียว (12/2026) — ถือว่าหมดอายุวันสุดท้ายของเดือน
  const my = /^(\d{1,2})[/.-](\d{4})$/.exec(text);
  if (my) {
    let year = Number(my[2]);
    if (year > 2400) year -= 543;
    const month = Number(my[1]);
    const last = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }

  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toNumber(raw: unknown): number | null {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** แยกข้อความที่วางมาจาก Excel/CSV เป็นบรรทัดข้อมูล */
export function parsePastedText(text: string): ImportLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const out: ImportLine[] = [];

  for (const line of lines) {
    const cells = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) =>
      c.trim().replace(/^"|"$/g, ""),
    );

    // ข้ามบรรทัดหัวตาราง
    const first = cells[0]?.toLowerCase() ?? "";
    if (["รหัส", "code", "ลำดับ", "no", "ที่"].includes(first)) continue;

    const [code, name, lotNo, expiry, qty, price, unit] = cells;
    if (!code && !name) continue;

    out.push({
      code: code || null,
      name: name || null,
      lot_no: lotNo || null,
      expiry_date: expiry || null,
      qty: qty ?? null,
      unit_price: price ?? null,
      unit: unit || null,
    });
  }

  return out;
}

/** จับคู่บรรทัดที่นำเข้ากับรายการในทะเบียนคลัง */
export async function matchLines(kind: StockKind, lines: ImportLine[]): Promise<MatchedLine[]> {
  const items = await query<{
    id: number;
    code: string;
    generic_name: string;
    trade_name: string | null;
  }>(
    `SELECT id, code, generic_name, trade_name FROM inventory_item WHERE kind = $1 AND is_active`,
    [kind],
  );

  const byCode = new Map(items.map((i) => [i.code.trim().toLowerCase(), i]));
  const byName = new Map<string, (typeof items)[number]>();
  for (const i of items) {
    byName.set(i.generic_name.trim().toLowerCase(), i);
    if (i.trade_name) byName.set(i.trade_name.trim().toLowerCase(), i);
  }

  return lines.map((line, idx) => {
    const errors: string[] = [];
    const code = line.code?.trim() || null;
    const name = line.name?.trim() || null;

    let match = code ? byCode.get(code.toLowerCase()) : undefined;
    let matchedBy: "code" | "name" | null = match ? "code" : null;

    if (!match && name) {
      match = byName.get(name.toLowerCase());
      if (match) matchedBy = "name";
    }
    // บางใบส่งของใส่ชื่อไว้ช่องแรก — ลองจับคู่ชื่อจากช่องรหัสด้วย
    if (!match && code) {
      match = byName.get(code.toLowerCase());
      if (match) matchedBy = "name";
    }

    const qty = toNumber(line.qty);
    const expiry = parseDate(line.expiry_date);

    if (!match) errors.push("ไม่พบรายการนี้ในทะเบียนคลัง");
    if (qty === null || qty <= 0) errors.push("จำนวนต้องเป็นตัวเลขมากกว่า 0");
    if (!expiry) errors.push("ต้องระบุวันหมดอายุ");

    return {
      lineNo: idx + 1,
      code,
      name,
      lotNo: line.lot_no?.trim() || null,
      expiryDate: expiry,
      qty: qty ?? 0,
      unitPrice: toNumber(line.unit_price),
      itemId: match?.id ?? null,
      matchedName: match ? (match.trade_name ?? match.generic_name) : null,
      matchedBy,
      errors,
    };
  });
}

/** สร้างรายการใหม่ในทะเบียนคลังสำหรับบรรทัดที่ยังจับคู่ไม่ได้ */
export async function createMissingItems(
  kind: StockKind,
  lines: MatchedLine[],
  byUser: string,
): Promise<number> {
  let created = 0;

  for (const line of lines) {
    if (line.itemId) continue;
    const name = line.name || line.code;
    if (!name) continue;

    const code =
      line.name && line.code
        ? line.code
        : `IMP-${String(Date.now()).slice(-6)}-${String(line.lineNo).padStart(2, "0")}`;

    const row = await queryOne<{ id: number }>(
      `INSERT INTO inventory_item (kind, code, generic_name, unit_price, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
      [kind, code, name, line.unitPrice, byUser],
    );

    line.itemId = row!.id;
    line.matchedName = name;
    line.matchedBy = "code";
    line.errors = line.errors.filter((e) => e !== "ไม่พบรายการนี้ในทะเบียนคลัง");
    created += 1;
  }

  return created;
}

export interface ImportHeader {
  docNo?: string | null;
  moveDate: string;
  sourceDest?: string | null;
  warehouseId?: number | null;
  note?: string | null;
}

/** รับเข้าสต๊อกทุกบรรทัดที่จับคู่สำเร็จ */
export async function commitImport(
  kind: StockKind,
  header: ImportHeader,
  lines: MatchedLine[],
  byUser: string,
): Promise<{ received: number; totalQty: number }> {
  const ready = lines.filter((l) => l.itemId && l.errors.length === 0);
  if (ready.length === 0) throw new Error("ไม่มีบรรทัดที่พร้อมรับเข้า — กรุณาแก้ไขรายการที่ยังมีปัญหาก่อน");

  let totalQty = 0;
  for (const line of ready) {
    await receiveStock({
      kind,
      itemId: line.itemId!,
      moveDate: header.moveDate,
      moveType: "รับเข้า",
      qty: line.qty,
      docNo: header.docNo ?? null,
      lotNo: line.lotNo,
      expiryDate: line.expiryDate,
      warehouseId: header.warehouseId ?? null,
      sourceDest: header.sourceDest ?? "รับจาก รพ.แม่ข่าย",
      unitPrice: line.unitPrice,
      note: header.note ?? null,
      byUser,
    });
    totalQty += line.qty;
  }

  return { received: ready.length, totalQty };
}
