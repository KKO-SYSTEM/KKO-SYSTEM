import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { Role } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";

    if (!username || !password) {
      return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
    }

    const row = await queryOne<{
      id: number;
      username: string;
      password_hash: string;
      full_name: string;
      role: string;
      is_active: boolean;
    }>(
      `SELECT id, username, password_hash, full_name, role, is_active
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username],
    );

    // ข้อความเดียวกันทุกกรณี เพื่อไม่ให้เดาได้ว่าชื่อผู้ใช้นี้มีอยู่จริงหรือไม่
    const invalid = NextResponse.json(
      { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401 },
    );

    if (!row) return invalid;
    if (!(await verifyPassword(password, row.password_hash))) {
      await writeAudit({
        user: null,
        moduleKey: "system",
        action: "เข้าสู่ระบบไม่สำเร็จ",
        detail: `ชื่อผู้ใช้: ${username}`,
      });
      return invalid;
    }
    if (!row.is_active) {
      return NextResponse.json(
        { error: "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 403 },
      );
    }

    const user = {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role as Role,
    };

    await setSessionCookie(user);
    await writeAudit({ user, moduleKey: "system", action: "เข้าสู่ระบบ" });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("login failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
