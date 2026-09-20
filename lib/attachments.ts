import { getModule } from "./modules";
import { getSubTableByKey } from "./subtables";

/**
 * ไฟล์แนบ — เก็บไฟล์ไว้ในฐานข้อมูล (คอลัมน์ BYTEA) โดยตรง
 *
 * เลือกวิธีนี้เพราะไม่ต้องพึ่งบริการเก็บไฟล์ภายนอก ย้ายเครื่อง/ย้ายผู้ให้บริการ
 * ได้พร้อมฐานข้อมูลชุดเดียว และไฟล์เอกสารราชการทั่วไปมีขนาดไม่ใหญ่
 *
 * ref_key บอกว่าไฟล์แนบอยู่กับทะเบียนไหน
 *   - ทะเบียนหลัก   → "personnel", "vehicle", ...
 *   - ทะเบียนย่อย   → "vhv/meeting", "pcu/evidence", ...
 */

/** ขนาดสูงสุดต่อไฟล์ — 5 MB */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** ชนิดไฟล์ที่อนุญาต (นามสกุล → MIME ที่ใช้ตอนดาวน์โหลด) */
export const ALLOWED_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  zip: "application/zip",
};

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function isAllowedFile(fileName: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_EXT, extensionOf(fileName));
}

export function mimeFor(fileName: string, fallback?: string | null): string {
  const ext = extensionOf(fileName);
  return ALLOWED_EXT[ext] ?? fallback ?? "application/octet-stream";
}

/**
 * แปลง ref_key เป็นระบบงานที่ใช้ตรวจสิทธิ์
 * คืน null ถ้าเป็นคีย์ที่ระบบไม่รู้จัก (กันการแนบไฟล์ไปยังตารางที่ไม่ได้ลงทะเบียน)
 */
export function moduleOfRefKey(refKey: string): string | null {
  if (refKey.includes("/")) {
    return getSubTableByKey(refKey)?.moduleKey ?? null;
  }
  return getModule(refKey)?.key ?? null;
}

/** ชื่อทะเบียนสำหรับแสดงใน Audit Log */
export function refLabel(refKey: string): string {
  if (refKey.includes("/")) return getSubTableByKey(refKey)?.label ?? refKey;
  return getModule(refKey)?.label ?? refKey;
}

/** ย่อขนาดไฟล์ให้อ่านง่าย */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ไอคอนตามชนิดไฟล์ */
export function fileIcon(fileName: string): string {
  const ext = extensionOf(fileName);
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "🖼️";
  if (ext === "pdf") return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (ext === "zip") return "🗜️";
  return "📄";
}
