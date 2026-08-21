/**
 * ประเภทการลาตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555
 * ครบทั้ง 11 ประเภท พร้อมสิทธิ์และเงื่อนไขตามระเบียบ
 */

export interface LeaveType {
  code: string;
  label: string;
  /** สิทธิ์สูงสุดต่อปีงบประมาณ (วันทำการ) — null = ตามความจำเป็น/ตามที่อนุญาต */
  maxDaysPerYear: number | null;
  /** หน่วยของสิทธิ์ ใช้แสดงผลเท่านั้น */
  quotaNote: string;
  /** ต้องแนบเอกสารประกอบหรือไม่ */
  requiresAttachment: boolean;
  attachmentNote?: string;
  /** ต้องยื่นล่วงหน้ากี่วัน (0 = ไม่บังคับ) */
  advanceNoticeDays: number;
  /** สะสมวันลาข้ามปีได้หรือไม่ (ใช้กับลาพักผ่อน) */
  canAccumulate: boolean;
  note?: string;
}

export const LEAVE_TYPES: LeaveType[] = [
  {
    code: "sick",
    label: "ลาป่วย",
    maxDaysPerYear: null,
    quotaNote: "ตามความจำเป็น",
    requiresAttachment: false,
    attachmentNote: "ต้องมีใบรับรองแพทย์เมื่อลาตั้งแต่ 30 วันขึ้นไป",
    advanceNoticeDays: 0,
    canAccumulate: false,
    note: "ลาป่วยตั้งแต่ 30 วันขึ้นไปต้องแนบใบรับรองแพทย์",
  },
  {
    code: "maternity",
    label: "ลาคลอดบุตร",
    maxDaysPerYear: 90,
    quotaNote: "ไม่เกิน 90 วัน",
    requiresAttachment: false,
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "paternity",
    label: "ลาไปช่วยเหลือภริยาที่คลอดบุตร",
    maxDaysPerYear: 15,
    quotaNote: "ไม่เกิน 15 วันทำการ",
    requiresAttachment: true,
    attachmentNote: "หนังสือแสดงการคลอดบุตร",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "personal",
    label: "ลากิจส่วนตัว",
    maxDaysPerYear: 10,
    quotaNote: "ไม่เกิน 10 วันทำการต่อปี",
    requiresAttachment: false,
    advanceNoticeDays: 1,
    canAccumulate: false,
    note: "ต้องได้รับอนุญาตก่อนจึงจะหยุดราชการได้",
  },
  {
    code: "vacation",
    label: "ลาพักผ่อน",
    maxDaysPerYear: 10,
    quotaNote: "10 วันทำการต่อปี (สะสมได้)",
    requiresAttachment: false,
    advanceNoticeDays: 0,
    canAccumulate: true,
    note: "สะสมวันลาที่ยังไม่ได้ใช้ไปปีถัดไปได้ตามหลักเกณฑ์",
  },
  {
    code: "ordination",
    label: "ลาอุปสมบท หรือประกอบพิธีฮัจย์",
    maxDaysPerYear: null,
    quotaNote: "ตามที่ได้รับอนุญาต",
    requiresAttachment: false,
    advanceNoticeDays: 60,
    canAccumulate: false,
    note: "ต้องยื่นใบลาล่วงหน้าไม่น้อยกว่า 60 วัน",
  },
  {
    code: "military",
    label: "ลาเข้ารับการตรวจเลือกหรือเข้ารับการเตรียมพล",
    maxDaysPerYear: null,
    quotaNote: "ตามหมายเรียก",
    requiresAttachment: true,
    attachmentNote: "หมายเรียกของทางราชการทหาร",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "study",
    label: "ลาไปศึกษา ฝึกอบรม ปฏิบัติการวิจัย หรือดูงาน",
    maxDaysPerYear: null,
    quotaNote: "ตามที่ได้รับอนุญาต",
    requiresAttachment: true,
    attachmentNote: "หนังสืออนุมัติให้ไปศึกษา/ฝึกอบรม",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "intl_org",
    label: "ลาไปปฏิบัติงานในองค์การระหว่างประเทศ",
    maxDaysPerYear: null,
    quotaNote: "ตามที่ได้รับอนุญาต",
    requiresAttachment: true,
    attachmentNote: "หนังสืออนุมัติจากผู้บังคับบัญชา",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "follow_spouse",
    label: "ลาติดตามคู่สมรส",
    maxDaysPerYear: null,
    quotaNote: "ครั้งละไม่เกิน 2 ปี รวมไม่เกิน 4 ปี",
    requiresAttachment: true,
    attachmentNote: "หลักฐานการย้ายไปปฏิบัติงานของคู่สมรส",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
  {
    code: "rehab",
    label: "ลาไปฟื้นฟูสมรรถภาพด้านอาชีพ",
    maxDaysPerYear: 365,
    quotaNote: "ไม่เกิน 12 เดือน",
    requiresAttachment: true,
    attachmentNote: "ใบรับรองความพิการหรือการได้รับอันตรายจากการปฏิบัติหน้าที่",
    advanceNoticeDays: 0,
    canAccumulate: false,
  },
];

export const LEAVE_TYPE_MAP: Record<string, LeaveType> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.code, t]),
);

export function getLeaveType(code: string): LeaveType | null {
  return LEAVE_TYPE_MAP[code] ?? null;
}

export const LEAVE_STATUS = {
  draft: "ร่าง",
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
} as const;

export type LeaveStatus = keyof typeof LEAVE_STATUS;

/**
 * ปีงบประมาณไทย — เริ่ม 1 ตุลาคม สิ้นสุด 30 กันยายน
 * เช่น 1 ต.ค. 2568 - 30 ก.ย. 2569 = ปีงบประมาณ 2569
 */
export function fiscalYearOf(date: Date): number {
  const year = date.getFullYear() + 543; // พ.ศ.
  return date.getMonth() >= 9 ? year + 1 : year;
}

export function fiscalYearRange(fiscalYear: number): { start: string; end: string } {
  const startCE = fiscalYear - 543 - 1;
  const endCE = fiscalYear - 543;
  return { start: `${startCE}-10-01`, end: `${endCE}-09-30` };
}

/**
 * นับจำนวนวันทำการระหว่างสองวัน (ไม่นับเสาร์-อาทิตย์)
 * วันหยุดนักขัตฤกษ์ให้ผู้ดูแลระบบเพิ่มในตาราง holiday แล้วส่งเข้ามาเป็น excludeDates
 */
export function countWorkingDays(
  startDate: string,
  endDate: string,
  excludeDates: string[] = [],
): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const excluded = new Set(excludeDates);
  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getUTCDay(); // 0 = อาทิตย์, 6 = เสาร์
    const iso = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !excluded.has(iso)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}
