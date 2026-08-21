import { assertIdent, query, queryOne } from "./db";
import type { FieldDef, ModuleDef } from "./modules";

export interface ListParams {
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_PAGE_SIZE = 500;

/** แปลงค่าจากฟอร์มให้ตรงชนิดคอลัมน์ — ค่าว่างกลายเป็น NULL */
function coerce(field: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null) return null;
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === "") return null;

  if (field.type === "number") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return value;
}

/** ฟิลด์ที่ผู้ใช้กรอกได้ (ไม่รวมฟิลด์ที่ระบบคำนวณให้) */
function writableFields(mod: ModuleDef): FieldDef[] {
  return mod.fields.filter((f) => !f.computed);
}

export function validate(mod: ModuleDef, body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of writableFields(mod)) {
    if (!field.required) continue;
    if (coerce(field, body[field.key]) === null) errors.push(`กรุณากรอก "${field.label}"`);
  }
  return errors;
}

/** สร้างเงื่อนไข WHERE จาก fixedFilter + คำค้นหา */
function buildWhere(
  mod: ModuleDef,
  search: string | undefined,
): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];

  if (mod.fixedFilter) {
    values.push(mod.fixedFilter.value);
    parts.push(`${assertIdent(mod.fixedFilter.column)} = $${values.length}`);
  }

  const term = search?.trim();
  if (term) {
    values.push(`%${term}%`);
    const idx = values.length;
    const conditions = mod.fields
      .map((f) => `COALESCE(${assertIdent(f.key)}::text, '') ILIKE $${idx}`)
      .join(" OR ");
    parts.push(`(${conditions})`);
  }

  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", values };
}

export async function listRecords(mod: ModuleDef, params: ListParams): Promise<ListResult> {
  const table = assertIdent(mod.table);
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize || 25));

  const sortable = new Set([...mod.fields.map((f) => f.key), "id", "created_at", "updated_at"]);
  const sortCol = params.sort && sortable.has(params.sort) ? params.sort : mod.defaultSort;
  const sortDir = params.dir === "desc" ? "DESC" : params.dir === "asc" ? "ASC" : mod.defaultSortDir === "desc" ? "DESC" : "ASC";

  const { clause, values } = buildWhere(mod, params.search);

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${clause}`,
    values,
  );
  const total = Number(countRow?.count ?? 0);

  const cols = ["id", ...mod.fields.map((f) => assertIdent(f.key)), "updated_at", "updated_by"];
  const rows = await query(
    `SELECT ${cols.join(", ")} FROM ${table} ${clause}
     ORDER BY ${assertIdent(sortCol)} ${sortDir} NULLS LAST, id DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    values,
  );

  return { rows, total, page, pageSize };
}

export async function allRecords(mod: ModuleDef, search?: string): Promise<Record<string, unknown>[]> {
  const table = assertIdent(mod.table);
  const { clause, values } = buildWhere(mod, search);
  const cols = ["id", ...mod.fields.map((f) => assertIdent(f.key))];
  const dir = mod.defaultSortDir === "desc" ? "DESC" : "ASC";

  return query(
    `SELECT ${cols.join(", ")} FROM ${table} ${clause}
     ORDER BY ${assertIdent(mod.defaultSort)} ${dir} NULLS LAST`,
    values,
  );
}

export async function getRecord(mod: ModuleDef, id: number): Promise<Record<string, unknown> | null> {
  const table = assertIdent(mod.table);
  const cols = ["id", ...mod.fields.map((f) => assertIdent(f.key))];

  if (mod.fixedFilter) {
    return queryOne(
      `SELECT ${cols.join(", ")} FROM ${table}
       WHERE id = $1 AND ${assertIdent(mod.fixedFilter.column)} = $2`,
      [id, mod.fixedFilter.value],
    );
  }
  return queryOne(`SELECT ${cols.join(", ")} FROM ${table} WHERE id = $1`, [id]);
}

export async function createRecord(
  mod: ModuleDef,
  body: Record<string, unknown>,
  byUser: string,
): Promise<Record<string, unknown>> {
  const table = assertIdent(mod.table);
  const cols: string[] = [];
  const values: unknown[] = [];

  for (const field of writableFields(mod)) {
    cols.push(assertIdent(field.key));
    values.push(coerce(field, body[field.key]));
  }

  if (mod.fixedFilter) {
    cols.push(assertIdent(mod.fixedFilter.column));
    values.push(mod.fixedFilter.value);
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

export async function updateRecord(
  mod: ModuleDef,
  id: number,
  body: Record<string, unknown>,
  byUser: string,
): Promise<Record<string, unknown> | null> {
  const table = assertIdent(mod.table);
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of writableFields(mod)) {
    values.push(coerce(field, body[field.key]));
    sets.push(`${assertIdent(field.key)} = $${values.length}`);
  }

  values.push(byUser);
  sets.push(`updated_by = $${values.length}`);
  sets.push(`updated_at = NOW()`);

  values.push(id);
  let where = `id = $${values.length}`;
  if (mod.fixedFilter) {
    values.push(mod.fixedFilter.value);
    where += ` AND ${assertIdent(mod.fixedFilter.column)} = $${values.length}`;
  }

  const rows = await query(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${where} RETURNING *`, values);
  return rows[0] ?? null;
}

export async function deleteRecord(mod: ModuleDef, id: number): Promise<boolean> {
  const table = assertIdent(mod.table);
  const values: unknown[] = [id];
  let where = `id = $1`;

  if (mod.fixedFilter) {
    values.push(mod.fixedFilter.value);
    where += ` AND ${assertIdent(mod.fixedFilter.column)} = $2`;
  }

  const rows = await query(`DELETE FROM ${table} WHERE ${where} RETURNING id`, values);
  return rows.length > 0;
}

/** ป้ายกำกับสั้นๆ ของแถว ใช้ในข้อความ Audit Log */
export function recordLabel(mod: ModuleDef, row: Record<string, unknown>): string {
  const nameParts = ["first_name", "last_name"]
    .filter((k) => mod.fields.some((f) => f.key === k))
    .map((k) => row[k])
    .filter(Boolean);
  if (nameParts.length) return nameParts.join(" ");

  const textField = mod.fields.find((f) => f.type === "text" && f.required) ?? mod.fields[0];
  const value = row[textField.key];
  return value === null || value === undefined || value === "" ? `#${row.id ?? "?"}` : String(value);
}

/**
 * บันทึกประวัติการแก้ไขรายฟิลด์ (ค่าเดิม → ค่าใหม่)
 * เรียกก่อน update เพื่อเทียบค่าเก่ากับค่าใหม่
 */
export async function writeHistory(
  mod: ModuleDef,
  id: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  byUser: string,
): Promise<void> {
  const toText = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  };

  try {
    for (const field of writableFields(mod)) {
      const oldValue = toText(before[field.key]);
      const newValue = toText(after[field.key]);
      if (oldValue === newValue) continue;

      await query(
        `INSERT INTO record_history (table_name, record_id, field_key, field_label, old_value, new_value, changed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [mod.table, id, field.key, field.label, oldValue, newValue, byUser],
      );
    }
  } catch (err) {
    console.error("writeHistory failed:", err);
  }
}
