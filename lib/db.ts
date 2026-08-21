import { Pool, type QueryResultRow } from "pg";

/**
 * Connection pool แบบ singleton
 * บน Vercel (serverless) แต่ละ instance จะใช้ pool เล็กๆ ร่วมกันข้าม request
 */

declare global {
  // eslint-disable-next-line no-var
  var __rphcPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า DATABASE_URL — กรุณาเพิ่ม environment variable นี้ก่อนใช้งาน",
    );
  }

  // ผู้ให้บริการฐานข้อมูลบน cloud (Neon, Supabase, Vercel Postgres) ต้องใช้ SSL
  // ส่วนฐานข้อมูลในเครื่อง (localhost) ไม่ต้อง
  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
}

export function getPool(): Pool {
  if (!global.__rphcPool) {
    global.__rphcPool = createPool();
  }
  return global.__rphcPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * ป้องกัน SQL injection ผ่านชื่อตาราง/คอลัมน์
 *
 * ค่าทั้งหมด (values) ใช้ parameterized query อยู่แล้ว แต่ชื่อตารางและคอลัมน์
 * ต้องต่อเป็น string จึงตรวจซ้ำอีกชั้นแม้ว่าจะมาจาก registry ที่เรากำหนดเองก็ตาม
 */
export function assertIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`ชื่อคอลัมน์หรือตารางไม่ถูกต้อง: ${name}`);
  }
  return name;
}

/** ตรวจว่าฐานข้อมูลถูกติดตั้ง (มีตาราง users) แล้วหรือยัง */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'users'
       ) AS exists`,
    );
    return row?.exists === true;
  } catch {
    return false;
  }
}

/** มีบัญชีผู้ใช้อยู่แล้วหรือยัง (ใช้กันไม่ให้ /setup ถูกเรียกซ้ำ) */
export async function hasAnyUser(): Promise<boolean> {
  try {
    const row = await queryOne<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
    return Number(row?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
