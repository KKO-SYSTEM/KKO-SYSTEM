import { NextResponse } from "next/server";
import { hashPassword, requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canManageUsers, isValidRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/users — รายชื่อผู้ใช้ทั้งหมด (แอดมินเท่านั้น) */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  try {
    const rows = await query(
      `SELECT id, username, full_name, role, is_active, created_at
       FROM users ORDER BY created_at ASC`,
    );
    return NextResponse.json({ rows, currentUserId: user.id });
  } catch (err) {
    console.error("list users failed:", err);
    return NextResponse.json({ error: "อ่านรายชื่อผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}

/** POST /api/users — สร้างบัญชีผู้ใช้ใหม่ (แอดมินเท่านั้น) */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      username?: string;
      password?: string;
      fullName?: string;
      role?: string;
    };

    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const role = body.role ?? "";

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข ความยาว 3-32 ตัวอักษร" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: "กรุณากรอกชื่อ-สกุล" }, { status: 400 });
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    }

    const existing = await queryOne(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [
      username,
    ]);
    if (existing) {
      return NextResponse.json({ error: "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const rows = await query<{ id: number }>(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, passwordHash, fullName, role],
    );

    await writeAudit({
      user,
      moduleKey: "system",
      action: "เพิ่มผู้ใช้งาน",
      detail: `${fullName} (${username})`,
      recordId: rows[0].id,
    });

    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("create user failed:", err);
    return NextResponse.json({ error: "สร้างบัญชีไม่สำเร็จ" }, { status: 500 });
  }
}
