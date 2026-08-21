/**
 * สิทธิ์ตามบทบาท — บังคับใช้ที่ฝั่งเซิร์ฟเวอร์ทุก API (ไม่ใช่แค่ซ่อนเมนู)
 */

export type Role =
  | "admin"
  | "exec"
  | "office"
  | "supply"
  | "health"
  | "finance"
  | "vhv"
  | "external";

export const ROLES: { key: Role; label: string; description: string }[] = [
  { key: "admin", label: "ผู้ดูแลระบบ", description: "เข้าถึงทุกระบบ จัดการผู้ใช้ และดู Audit Log" },
  { key: "exec", label: "ผู้บริหาร รพ.สต.", description: "ดูได้ทุกระบบและรายงาน แต่แก้ไขข้อมูลไม่ได้" },
  { key: "office", label: "เจ้าหน้าที่สำนักงาน", description: "งานบุคลากร และงาน อสม./ประชุม" },
  { key: "supply", label: "เจ้าหน้าที่พัสดุ", description: "คลังยา คลังวัคซีน ครุภัณฑ์ และยานพาหนะ" },
  { key: "health", label: "เจ้าหน้าที่สาธารณสุข", description: "ระบาดวิทยา อนามัยโรงเรียน และมาตรฐาน PCU" },
  { key: "finance", label: "เจ้าหน้าที่การเงิน", description: "แผนยุทธศาสตร์และงบประมาณ" },
  { key: "vhv", label: "อสม.", description: "ดูข้อมูลงาน อสม./ประชุม อย่างเดียว" },
  { key: "external", label: "ผู้เกี่ยวข้องภายนอก", description: "ดู Dashboard และรายงานอย่างเดียว" },
];

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.key, r.label]),
);

const ALL_MODULES = [
  "personnel",
  "pharmacy",
  "vaccine",
  "vehicle",
  "equipment",
  "epidemiology",
  "strategy",
  "pcu",
  "schoolhealth",
  "vhv",
];

/** โมดูลที่แต่ละบทบาทเข้าถึงได้ */
export const ROLE_MODULES: Record<Role, string[]> = {
  admin: ALL_MODULES,
  exec: ALL_MODULES,
  office: ["personnel", "vhv"],
  supply: ["pharmacy", "vaccine", "equipment", "vehicle"],
  health: ["epidemiology", "schoolhealth", "pcu"],
  finance: ["strategy"],
  vhv: ["vhv"],
  external: [],
};

/** บทบาทที่ดูได้อย่างเดียว แก้ไข/เพิ่ม/ลบไม่ได้ */
export const READONLY_ROLES: Role[] = ["exec", "vhv", "external"];

export function isValidRole(role: string): role is Role {
  return ROLES.some((r) => r.key === role);
}

export function canAccessModule(role: string, moduleKey: string): boolean {
  if (!isValidRole(role)) return false;
  return ROLE_MODULES[role].includes(moduleKey);
}

export function canWrite(role: string): boolean {
  if (!isValidRole(role)) return false;
  return !READONLY_ROLES.includes(role);
}

export function canWriteModule(role: string, moduleKey: string): boolean {
  return canAccessModule(role, moduleKey) && canWrite(role);
}

/** ดู Audit Log ได้เฉพาะแอดมินและผู้บริหาร */
export function canViewAudit(role: string): boolean {
  return role === "admin" || role === "exec";
}

/**
 * อนุมัติเอกสารได้เฉพาะผู้บริหารและแอดมิน
 * (ผู้บริหารดูอย่างเดียวในงานข้อมูล แต่เป็นผู้มีอำนาจอนุมัติตามสายบังคับบัญชา)
 */
export function canApprove(role: string): boolean {
  return role === "admin" || role === "exec";
}

/** จัดการผู้ใช้ได้เฉพาะแอดมิน */
export function canManageUsers(role: string): boolean {
  return role === "admin";
}
