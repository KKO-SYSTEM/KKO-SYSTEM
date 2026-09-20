import { queryOne } from "./db";

/** ข้อมูลหน่วยงานสำหรับหัวเอกสารที่พิมพ์ออก */
export interface OrgInfo {
  org_name: string;
  parent_org: string | null;
  district: string | null;
  province: string | null;
  director_name: string | null;
  director_title: string | null;
  address: string | null;
  phone: string | null;
}

export async function getOrg(): Promise<OrgInfo> {
  const row = await queryOne<OrgInfo>(
    `SELECT org_name, parent_org, district, province, director_name, director_title, address, phone
     FROM org_settings WHERE id = 1`,
  );
  return (
    row ?? {
      org_name: "โรงพยาบาลส่งเสริมสุขภาพตำบล",
      parent_org: null,
      district: null,
      province: null,
      director_name: null,
      director_title: "ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบล",
      address: null,
      phone: null,
    }
  );
}

/** วันที่แบบไทยเต็ม เช่น 20 กันยายน 2569 */
export function thaiDate(value: string | Date | null | undefined, dots = 30): string {
  if (!value) return ".".repeat(dots);
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

/** วันที่+เวลาแบบไทย */
export function thaiDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** เติมจุดไข่ปลาเมื่อไม่มีค่า — ใช้กับแบบฟอร์มราชการ */
export function orDots(value: unknown, dots = 25): string {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text === "" ? ".".repeat(dots) : text;
}

export const nfmt = (n: unknown): string =>
  Number(n ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** แปลงจำนวนเงินเป็นตัวอักษรภาษาไทย (ใช้ในใบเบิก/ใบยืมตามแบบราชการ) */
export function bahtText(amount: number): string {
  if (!Number.isFinite(amount)) return "-";
  const negative = amount < 0;
  const value = Math.abs(Math.round(amount * 100) / 100);
  const baht = Math.floor(value);
  const satang = Math.round((value - baht) * 100);

  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  function read(num: number): string {
    if (num === 0) return "ศูนย์";
    let text = "";
    const str = String(num);

    if (str.length > 7) {
      const head = Math.floor(num / 1_000_000);
      const tail = num % 1_000_000;
      return read(head) + "ล้าน" + (tail > 0 ? read(tail) : "");
    }

    for (let i = 0; i < str.length; i++) {
      const digit = Number(str[i]);
      const position = str.length - i - 1;
      if (digit === 0) continue;

      if (position === 1 && digit === 1) text += "สิบ";
      else if (position === 1 && digit === 2) text += "ยี่สิบ";
      else if (position === 0 && digit === 1 && str.length > 1) text += "เอ็ด";
      else text += digits[digit] + units[position];
    }
    return text;
  }

  let result = (negative ? "ลบ" : "") + read(baht) + "บาท";
  result += satang === 0 ? "ถ้วน" : read(satang) + "สตางค์";
  return result;
}
