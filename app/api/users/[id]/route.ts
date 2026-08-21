import { NextResponse } from "next/server";
import { hashPassword, requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canManageUsers, isValidRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/users/[id] — แก้ไขผู้ใช้ / เปลี่ยนรหัสผ่าน / เปิด-ปิดบัญชี */
export async function PUT(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageUsers(user.role)) {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const target = await queryOne<{ username: string; role: string; is_active: boolean }>(
      `SELECT username, role, is_active FROM users WHERE id = $1`,
      [id],
    );
    if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

    const body = (await req.json()) as {
      fullName?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    };

    // กันไม่ให้แอดมินคนสุดท้ายถูกลดสิทธิ์หรือปิดบัญชีจนไม่มีใครดูแลระบบ
    const losingAdmin =
      target.role === "admin" &&
      ((body.role !== undefined && body.role !== "admin") || body.isActive === false);

    if (losingAdmin) {
      const row = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin' AND is_active AND id <> $1`,
        [id],
      );
      if (Number(row?.count ?? 0) === 0) {
        return NextResponse.json(
          { error: "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 บัญชีเสมอ" },
          { status: 400 },
        );
      }
    }

    if (body.role !== undefined && !isValidRole(body.role)) {
      return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    }
    if (body.password !== undefined && body.password.length > 0 && body.password.length < 8) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.fullName !== undefined && body.fullName.trim()) {
      values.push(body.fullName.trim());
      sets.push(`full_name = $${values.length}`);
    }
    if (body.role !== undefined) {
      values.push(body.role);
      sets.push(`role = $${values.length}`);
    }
    if (body.isActive !== undefined) {
      values.push(body.isActive);
      sets.push(`is_active = $${values.length}`);
    }
    if (body.password) {
      values.push(await hashPassword(body.password));
      sets.push(`password_hash = $${values.length}`);
    }

    if (!sets.length) return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });

    sets.push(`updated_at = NOW()`);
    values.push(id);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${values.length}`, values);

    await writeAudit({
      user,
      moduleKey: "system",
      action: body.password ? "เปลี่ยนรหัสผ่านผู้ใช้" : "แก้ไขข้อมูลผู้ใช้",
      detail: target.username,
      recordId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("update user failed:", err);
    return NextResponse.json({ error: "แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
