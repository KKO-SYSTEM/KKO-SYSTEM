import { NextResponse } from "next/server";
import { hasAnyUser, isDatabaseReady, query } from "@/lib/db";
import { migrate } from "@/lib/schema";
import { seedPcuCriteria, seedSampleData, seedWarehouses } from "@/lib/seed";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/setup — ตรวจสถานะการติดตั้ง */
export async function GET() {
  const envReady = Boolean(process.env.DATABASE_URL) && Boolean(process.env.AUTH_SECRET);

  if (!envReady) {
    return NextResponse.json({
      envReady: false,
      dbReady: false,
      hasUser: false,
      missing: [
        ...(process.env.DATABASE_URL ? [] : ["DATABASE_URL"]),
        ...(process.env.AUTH_SECRET ? [] : ["AUTH_SECRET"]),
      ],
    });
  }

  try {
    const dbReady = await isDatabaseReady();
    const hasUser = dbReady ? await hasAnyUser() : false;
    return NextResponse.json({ envReady: true, dbReady, hasUser, missing: [] });
  } catch (err) {
    return NextResponse.json({
      envReady: true,
      dbReady: false,
      hasUser: false,
      missing: [],
      error: err instanceof Error ? err.message : "เชื่อมต่อฐานข้อมูลไม่สำเร็จ",
    });
  }
}

/**
 * POST /api/setup — สร้างตารางและบัญชีแอดมินคนแรก
 *
 * ทำงานได้เฉพาะตอนที่ยังไม่มีผู้ใช้ในระบบเท่านั้น
 * หลังจากมีแอดมินแล้ว endpoint นี้จะปฏิเสธทุกคำขอ
 */
export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า DATABASE_URL และ AUTH_SECRET" },
        { status: 400 },
      );
    }

    const body = (await req.json()) as {
      username?: string;
      password?: string;
      fullName?: string;
      withSample?: boolean;
    };

    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || username;

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข ความยาว 3-32 ตัวอักษร" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }

    await migrate();

    if (await hasAnyUser()) {
      return NextResponse.json(
        { error: "ระบบถูกติดตั้งไปแล้ว ไม่สามารถสร้างแอดมินซ้ำได้ กรุณาเข้าสู่ระบบ" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const rows = await query<{ id: number }>(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin') RETURNING id`,
      [username, passwordHash, fullName],
    );
    const userId = rows[0].id;

    // ข้อมูลตั้งต้นที่ระบบต้องมีเสมอ
    await seedPcuCriteria();
    await seedWarehouses();

    let seeded = 0;
    if (body.withSample) {
      seeded = await seedSampleData(username);
    }

    const user = { id: userId, username, fullName, role: "admin" as const };
    await writeAudit({
      user,
      moduleKey: "system",
      action: "ติดตั้งระบบ",
      detail: `สร้างบัญชีแอดมินคนแรก${seeded ? ` และใส่ข้อมูลตัวอย่าง ${seeded} รายการ` : ""}`,
    });

    await setSessionCookie(user);
    return NextResponse.json({ ok: true, seeded });
  } catch (err) {
    console.error("setup failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ติดตั้งไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
