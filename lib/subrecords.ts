import { assertIdent, query, queryOne } from "./db";
import type { FieldDef } from "./modules";
import type { SubTableDef } from "./subtables";

/**
 * CRUD สำหรับตารางย่อย + กฎการคำนวณอัตโนมัติตามระเบียบ
 */

function coerce(field: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === "") return null;

  if (field.type === "number" || field.type === "lookup") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return value;
}

function writableFields(def: SubTableDef): FieldDef[] {
  return def.fields.filter((f) => !f.computed);
}

export function validateSub(def: SubTableDef, body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of writableFields(def)) {
    if (!field.required) continue;
    if (coerce(field, body[field.key]) === null) errors.push(`กรุณากรอก "${field.label}"`);
  }
  return errors;
}

/**
 * กฎคำนวณอัตโนมัติของแต่ละตาราง
 * คืนค่าคอลัมน์เพิ่มเติมที่ระบบเติมให้เอง
 */
function computeFields(def: SubTableDef, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const num = (k: string): number | null => {
    const v = body[k];
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  switch (def.table) {
    /* บันทึกการใช้รถ — ระยะทาง = ไมล์กลับ - ไมล์ออก */
    case "vehicle_log": {
      const start = num("mileage_start");
      const end = num("mileage_end");
      out.distance = start !== null && end !== null && end >= start ? end - start : null;
      break;
    }

    /* เบิกน้ำมัน — เป็นเงิน = ลิตร × ราคาต่อลิตร */
    case "fuel_log": {
      const liters = num("liters");
      const price = num("price_per_lit");
      out.total_amount =
        liters !== null && price !== null ? Math.round(liters * price * 100) / 100 : null;
      break;
    }

    /* วัคซีนในโรงเรียน — ความครอบคลุม % */
    case "school_vaccination": {
      const target = num("target_count");
      const received = num("received_count");
      out.coverage_pct =
        target !== null && target > 0 && received !== null
          ? Math.round((received / target) * 1000) / 10
          : null;
      break;
    }

    /* อุณหภูมิตู้เย็นวัคซีน — ปกติคือ 2-8°C */
    case "fridge_temp_log": {
      const temp = num("temperature");
      out.is_normal = temp === null ? null : temp >= 2 && temp <= 8;
      break;
    }

    /* พื้นที่ระบาด — อัตราป่วยต่อประชากรพันคน */
    case "outbreak_area": {
      const cases = num("case_count");
      const pop = num("population");
      out.attack_rate =
        cases !== null && pop !== null && pop > 0
          ? Math.round((cases / pop) * 1000 * 100) / 100
          : null;
      break;
    }

    /* รายงานผลโครงการ — ร้อยละความสำเร็จเทียบเป้าหมาย */
    case "project_report": {
      const target = num("target_count");
      const actual = num("actual_count");
      out.achievement_pct =
        target !== null && target > 0 && actual !== null
          ? Math.round((actual / target) * 1000) / 10
          : null;
      break;
    }

    /* ใบยืมพัสดุ — คืนแล้ว / เกินกำหนด */
    case "asset_loan": {
      const returned = body.returned_date;
      if (returned) {
        out.status = "returned";
      } else if (body.due_date && !body.status) {
        const due = new Date(String(body.due_date));
        out.status = due < new Date() ? "overdue" : "borrowed";
      }
      break;
    }
  }

  return out;
}

export interface SubListResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * สร้าง SELECT พร้อมดึงชื่อจากตาราง lookup มาแสดงเป็นคอลัมน์ <field>_label
 *
 * ใช้ correlated subquery แทน JOIN เพื่อให้ labelExpr ในทะเบียนเขียนชื่อคอลัมน์
 * ได้ตรง ๆ โดยไม่ต้องเติม alias เอง (ลดโอกาสเขียนผิด)
 */
function selectColumns(def: SubTableDef): { cols: string[]; joins: string[] } {
  const cols = ["t.id"];

  for (const f of def.fields) {
    const col = assertIdent(f.key);
    cols.push(`t.${col}`);

    if (f.type === "lookup" && f.lookup) {
      const lookupTable = assertIdent(f.lookup.table);
      cols.push(
        `(SELECT ${f.lookup.labelExpr} FROM ${lookupTable} WHERE id = t.${col}) AS ${col}_label`,
      );
    }
  }

  cols.push("t.updated_at", "t.updated_by");
  return { cols, joins: [] };
}

function buildWhere(def: SubTableDef, search?: string): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];

  if (def.fixedFilter) {
    values.push(def.fixedFilter.value);
    parts.push(`t.${assertIdent(def.fixedFilter.column)} = $${values.length}`);
  }

  const term = search?.trim();
  if (term) {
    values.push(`%${term}%`);
    const idx = values.length;
    const conditions = def.fields
      .filter((f) => f.type !== "lookup")
      .map((f) => `COALESCE(t.${assertIdent(f.key)}::text, '') ILIKE $${idx}`)
      .join(" OR ");
    if (conditions) parts.push(`(${conditions})`);
  }

  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

export async function listSub(
  def: SubTableDef,
  params: { search?: string; page?: number; pageSize?: number },
): Promise<SubListResult> {
  const table = assertIdent(def.table);
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize || 25));

  const { clause, values } = buildWhere(def, params.search);
  const { cols, joins } = selectColumns(def);

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} t ${clause}`,
    values,
  );
  const total = Number(countRow?.count ?? 0);

  const dir = def.defaultSortDir === "desc" ? "DESC" : "ASC";
  const rows = await query(
    `SELECT ${cols.join(", ")} FROM ${table} t ${joins.join(" ")} ${clause}
     ORDER BY t.${assertIdent(def.defaultSort)} ${dir} NULLS LAST, t.id DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    values,
  );

  return { rows, total, page, pageSize };
}

export async function getSub(def: SubTableDef, id: number): Promise<Record<string, unknown> | null> {
  const table = assertIdent(def.table);
  const cols = ["id", ...def.fields.map((f) => assertIdent(f.key))];
  return queryOne(`SELECT ${cols.join(", ")} FROM ${table} WHERE id = $1`, [id]);
}

export async function createSub(
  def: SubTableDef,
  body: Record<string, unknown>,
  byUser: string,
): Promise<Record<string, unknown>> {
  const table = assertIdent(def.table);
  const cols: string[] = [];
  const values: unknown[] = [];

  for (const field of writableFields(def)) {
    cols.push(assertIdent(field.key));
    values.push(coerce(field, body[field.key]));
  }

  for (const [key, value] of Object.entries(computeFields(def, body))) {
    cols.push(assertIdent(key));
    values.push(value);
  }

  if (def.fixedFilter) {
    cols.push(assertIdent(def.fixedFilter.column));
    values.push(def.fixedFilter.value);
  }

  cols.push("created_by", "updated_by");
  values.push(byUser, byUser);

  const placeholders = values.map((_, i) => `$${i + 1}`);
  const rows = await query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
    values,
  );
  return rows[0];
}

export async function updateSub(
  def: SubTableDef,
  id: number,
  body: Record<string, unknown>,
  byUser: string,
): Promise<Record<string, unknown> | null> {
  const table = assertIdent(def.table);
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of writableFields(def)) {
    values.push(coerce(field, body[field.key]));
    sets.push(`${assertIdent(field.key)} = $${values.length}`);
  }

  for (const [key, value] of Object.entries(computeFields(def, body))) {
    values.push(value);
    sets.push(`${assertIdent(key)} = $${values.length}`);
  }

  values.push(byUser);
  sets.push(`updated_by = $${values.length}`);
  sets.push(`updated_at = NOW()`);

  values.push(id);
  const rows = await query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteSub(def: SubTableDef, id: number): Promise<boolean> {
  const table = assertIdent(def.table);
  const rows = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

export function subLabel(def: SubTableDef, row: Record<string, unknown>): string {
  const first = def.fields.find((f) => f.required && f.type === "text");
  if (first && row[first.key]) return String(row[first.key]);
  const anyText = def.fields.find((f) => f.type === "text" && row[f.key]);
  if (anyText) return String(row[anyText.key]);
  return `#${row.id ?? "?"}`;
}
