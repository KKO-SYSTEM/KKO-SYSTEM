import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import type { Role } from "./permissions";

export const SESSION_COOKIE = "rphc_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า AUTH_SECRET หรือสั้นเกินไป — ต้องมีอย่างน้อย 16 ตัวอักษร",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    uid: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.uid !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      id: payload.uid,
      username: payload.username,
      fullName: typeof payload.fullName === "string" ? payload.fullName : payload.username,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * อ่าน session ปัจจุบัน แล้วตรวจซ้ำกับฐานข้อมูลว่าบัญชียังใช้งานอยู่
 * (กันกรณีแอดมินปิดบัญชีไปแล้วแต่ token เดิมยังไม่หมดอายุ)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await readSessionToken(token);
  if (!session) return null;

  try {
    const row = await queryOne<{
      id: number;
      username: string;
      full_name: string;
      role: string;
      is_active: boolean;
    }>(`SELECT id, username, full_name, role, is_active FROM users WHERE id = $1`, [session.id]);

    if (!row || !row.is_active) return null;

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role as Role,
    };
  } catch {
    return null;
  }
}

/** ใช้ใน API route — คืน user หรือ null ให้ผู้เรียกตอบ 401 เอง */
export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}
