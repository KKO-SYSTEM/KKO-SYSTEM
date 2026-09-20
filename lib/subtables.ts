import type { FieldDef } from "./modules";

/**
 * ทะเบียนตารางย่อย — เมนูย่อยของแต่ละระบบงานที่เป็นการบันทึกข้อมูลตรงไปตรงมา
 *
 * ทั้ง API, ตาราง, ฟอร์ม และการตรวจสิทธิ์ อ่านจากไฟล์นี้ทั้งหมด
 * สิทธิ์ยึดตาม moduleKey ของระบบงานแม่
 */

export interface SubTableDef {
  /** คีย์เส้นทาง = "<moduleKey>/<slug>" */
  key: string;
  moduleKey: string;
  slug: string;
  table: string;
  label: string;
  icon: string;
  description: string;
  fields: FieldDef[];
  defaultSort: string;
  defaultSortDir: "asc" | "desc";
  /** กรองแถวคงที่ เช่น ใบเบิกยา vs ใบเบิกวัคซีน ใช้ตารางเดียวกัน */
  fixedFilter?: { column: string; value: string };
  /** เส้นทางหน้ารายละเอียด (สำหรับเอกสารที่มีรายการย่อยในใบ) */
  detailPath?: string;
  /** เส้นทางพิมพ์เอกสาร เช่น /print/vehicle-request/[id] */
  printPath?: string;
  printLabel?: string;
}

/* ── ตัวช่วยสร้าง lookup ที่ใช้บ่อย ── */

const lookupPersonnel = (key: string, label: string, required = false): FieldDef => ({
  key,
  label,
  type: "lookup",
  required,
  lookup: {
    table: "personnel",
    labelExpr: "COALESCE(prefix,'') || first_name || ' ' || last_name",
    filter: { column: "status", value: "ปฏิบัติงาน" },
    orderBy: "first_name",
  },
});

const lookupVehicle = (required = false): FieldDef => ({
  key: "vehicle_id",
  label: "รถ",
  type: "lookup",
  required,
  lookup: {
    table: "vehicle",
    labelExpr: "plate || ' — ' || COALESCE(vehicle_name,'')",
    orderBy: "plate",
  },
});

const lookupSchool = (required = true): FieldDef => ({
  key: "school_id",
  label: "โรงเรียน",
  type: "lookup",
  required,
  lookup: { table: "school", labelExpr: "school_name", orderBy: "school_name" },
});

const lookupVhv = (required = true): FieldDef => ({
  key: "vhv_id",
  label: "อสม.",
  type: "lookup",
  required,
  lookup: {
    table: "vhv",
    labelExpr: "COALESCE(prefix,'') || first_name || ' ' || last_name",
    orderBy: "first_name",
  },
});

const noteField: FieldDef = { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true };

const REQ_STATUS = ["pending", "approved", "issued", "rejected"];
const REQ_STATUS_TH: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  issued: "จ่ายแล้ว",
  rejected: "ไม่อนุมัติ",
};

export const SUB_STATUS_LABEL = REQ_STATUS_TH;

const SUB_LIST: SubTableDef[] = [
  /* ═══════ 1. บุคลากร ═══════ */
  {
    key: "personnel/roster",
    moduleKey: "personnel",
    slug: "roster",
    table: "duty_roster",
    label: "จัดการตารางเวร",
    icon: "📅",
    description: "บันทึกเวรปฏิบัติงานรายวันของเจ้าหน้าที่",
    defaultSort: "duty_date",
    defaultSortDir: "desc",
    fields: [
      { key: "duty_date", label: "วันที่", type: "date", required: true },
      {
        key: "shift",
        label: "ผลัด",
        type: "select",
        required: true,
        options: ["เช้า (08:30-16:30)", "บ่าย (16:30-00:30)", "ดึก (00:30-08:30)", "เวรวันหยุด"],
      },
      lookupPersonnel("personnel_id", "ผู้ปฏิบัติงาน", true),
      {
        key: "duty_type",
        label: "ประเภทเวร",
        type: "select",
        options: ["เวรปกติ", "เวรนอกเวลา", "เวรวันหยุดราชการ", "อยู่เวรแทน"],
      },
      noteField,
    ],
  },

  /* ═══════ 2-3. คลังยา / คลังวัคซีน ═══════ */
  {
    key: "pharmacy/requisition",
    moduleKey: "pharmacy",
    slug: "requisition",
    table: "requisition",
    label: "ใบเบิกยา",
    icon: "🧾",
    description: "ใบเบิกยาจากคลังใหญ่ไปคลังย่อย พร้อมสายอนุมัติ",
    defaultSort: "req_date",
    defaultSortDir: "desc",
    fixedFilter: { column: "kind", value: "drug" },
    detailPath: "/m/pharmacy/requisition",
    printPath: "/print/requisition",
    printLabel: "พิมพ์ใบเบิกยา",
    fields: [
      { key: "doc_no", label: "เลขที่ใบเบิก", type: "text" },
      { key: "req_date", label: "วันที่เบิก", type: "date", required: true },
      { key: "requester", label: "ผู้เบิก", type: "text", required: true },
      { key: "purpose", label: "วัตถุประสงค์", type: "text" },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: REQ_STATUS,
        badge: true,
      },
      { key: "approver_name", label: "ผู้อนุมัติ", type: "text", hideInTable: true },
      { key: "issuer_name", label: "ผู้จ่าย", type: "text", hideInTable: true },
      { key: "receiver_name", label: "ผู้รับของ", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vaccine/requisition",
    moduleKey: "vaccine",
    slug: "requisition",
    table: "requisition",
    label: "ใบเบิกวัคซีน",
    icon: "🧾",
    description: "ใบเบิกวัคซีนพร้อมสายอนุมัติ",
    defaultSort: "req_date",
    defaultSortDir: "desc",
    fixedFilter: { column: "kind", value: "vaccine" },
    detailPath: "/m/vaccine/requisition",
    printPath: "/print/requisition",
    printLabel: "พิมพ์ใบเบิกวัคซีน",
    fields: [
      { key: "doc_no", label: "เลขที่ใบเบิก", type: "text" },
      { key: "req_date", label: "วันที่เบิก", type: "date", required: true },
      { key: "requester", label: "ผู้เบิก", type: "text", required: true },
      { key: "purpose", label: "วัตถุประสงค์", type: "text" },
      { key: "status", label: "สถานะ", type: "select", options: REQ_STATUS, badge: true },
      { key: "approver_name", label: "ผู้อนุมัติ", type: "text", hideInTable: true },
      { key: "issuer_name", label: "ผู้จ่าย", type: "text", hideInTable: true },
      { key: "receiver_name", label: "ผู้รับของ", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vaccine/coldchain",
    moduleKey: "vaccine",
    slug: "coldchain",
    table: "fridge_temp_log",
    label: "บันทึกอุณหภูมิตู้เย็น",
    icon: "🌡️",
    description: "บันทึกอุณหภูมิตู้เย็นวัคซีนเช้า-บ่าย ตามระบบลูกโซ่ความเย็น",
    defaultSort: "log_date",
    defaultSortDir: "desc",
    fields: [
      { key: "log_date", label: "วันที่", type: "date", required: true },
      { key: "period", label: "ช่วงเวลา", type: "select", required: true, options: ["เช้า", "บ่าย"] },
      { key: "fridge_name", label: "ตู้เย็น", type: "text" },
      {
        key: "temperature",
        label: "อุณหภูมิ (°C)",
        type: "number",
        required: true,
        help: "เกณฑ์ปกติของวัคซีน EPI คือ 2-8°C",
      },
      { key: "recorded_by", label: "ผู้บันทึก", type: "text" },
      { key: "action_taken", label: "การแก้ไขเมื่อผิดปกติ", type: "textarea", hideInTable: true },
    ],
  },

  /* ═══════ 4. ยานพาหนะ ═══════ */
  {
    key: "vehicle/request",
    moduleKey: "vehicle",
    slug: "request",
    table: "vehicle_request",
    label: "ใบขออนุญาตใช้รถ (แบบ 3)",
    icon: "📋",
    description: "ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยรถราชการ — ต้องขออนุญาตล่วงหน้าอย่างน้อย 1 วัน",
    defaultSort: "written_date",
    defaultSortDir: "desc",
    printPath: "/print/vehicle-request",
    printLabel: "พิมพ์ใบขออนุญาตใช้รถ",
    fields: [
      { key: "doc_no", label: "เลขที่", type: "text" },
      { key: "written_date", label: "วันที่เขียนใบขอ", type: "date", required: true },
      { key: "addressed_to", label: "เรียน", type: "text", hideInTable: true },
      { key: "requester_name", label: "ผู้ขออนุญาต", type: "text", required: true },
      { key: "requester_position", label: "ตำแหน่ง", type: "text", hideInTable: true },
      lookupVehicle(),
      { key: "destination", label: "สถานที่ไป", type: "text", required: true },
      { key: "purpose", label: "เพื่อ (วัตถุประสงค์)", type: "textarea" },
      { key: "passenger_count", label: "จำนวนคนนั่ง", type: "number" },
      { key: "depart_at", label: "วัน-เวลาออกเดินทาง", type: "date" },
      { key: "return_at", label: "วัน-เวลากลับ", type: "date" },
      { key: "driver_name", label: "พนักงานขับรถ", type: "text", hideInTable: true },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: ["pending", "approved", "rejected"],
        badge: true,
      },
      { key: "supervisor_name", label: "หัวหน้างานผู้เห็นชอบ", type: "text", hideInTable: true },
      { key: "approver_name", label: "ผู้อนุญาต", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vehicle/log",
    moduleKey: "vehicle",
    slug: "log",
    table: "vehicle_log",
    label: "บันทึกการใช้รถ (แบบ 4)",
    icon: "🛣️",
    description: "บันทึกการใช้รถรายเที่ยว พร้อมเลขไมล์ออก-กลับ",
    defaultSort: "use_date",
    defaultSortDir: "desc",
    fields: [
      lookupVehicle(true),
      { key: "use_date", label: "วันที่", type: "date", required: true },
      { key: "depart_time", label: "เวลาออก", type: "time" },
      { key: "return_time", label: "เวลากลับ", type: "time" },
      { key: "user_name", label: "ผู้ใช้รถ", type: "text" },
      { key: "destination", label: "สถานที่ไป", type: "text" },
      { key: "mileage_start", label: "เลขไมล์ออก", type: "number" },
      { key: "mileage_end", label: "เลขไมล์กลับ", type: "number" },
      { key: "distance", label: "รวมระยะทาง (กม.)", type: "number", computed: true },
      { key: "driver_name", label: "พนักงานขับรถ", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vehicle/fuel",
    moduleKey: "vehicle",
    slug: "fuel",
    table: "fuel_log",
    label: "การเบิกน้ำมันเชื้อเพลิง",
    icon: "⛽",
    description: "บันทึกการเบิกน้ำมัน — ตามระเบียบต้องขออนุมัติเมื่อน้ำมันต่ำกว่า 1/4 ถัง",
    defaultSort: "fuel_date",
    defaultSortDir: "desc",
    fields: [
      lookupVehicle(true),
      { key: "fuel_date", label: "วันที่", type: "date", required: true },
      { key: "mileage", label: "เลขไมล์", type: "number" },
      { key: "liters", label: "จำนวนลิตร", type: "number", required: true },
      { key: "price_per_lit", label: "ราคาต่อลิตร (บาท)", type: "number" },
      { key: "total_amount", label: "เป็นเงิน (บาท)", type: "number", computed: true },
      { key: "station", label: "สถานีบริการ", type: "text", hideInTable: true },
      { key: "requester", label: "ผู้เบิก", type: "text" },
      { key: "approver_name", label: "ผู้อนุมัติ", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vehicle/maintenance",
    moduleKey: "vehicle",
    slug: "maintenance",
    table: "vehicle_maintenance",
    label: "ประวัติซ่อมบำรุง (แบบ 6)",
    icon: "🔧",
    description: "ประวัติการซ่อมบำรุงรถราชการ พร้อมการตรวจรับ",
    defaultSort: "service_date",
    defaultSortDir: "desc",
    fields: [
      lookupVehicle(true),
      { key: "service_date", label: "วันที่ซ่อม", type: "date", required: true },
      { key: "mileage", label: "เลขไมล์ขณะซ่อม", type: "number" },
      { key: "work_detail", label: "รายการที่ซ่อม", type: "textarea", required: true },
      { key: "cost", label: "ค่าใช้จ่าย (บาท)", type: "number" },
      { key: "service_place", label: "สถานที่ซ่อม", type: "text" },
      { key: "inspect_date", label: "วันที่ตรวจรับ", type: "date", hideInTable: true },
      { key: "inspector", label: "ผู้ตรวจรับ", type: "text", hideInTable: true },
      noteField,
    ],
  },

  /* ═══════ 5. ครุภัณฑ์ / พัสดุ ═══════ */
  {
    key: "equipment/supply",
    moduleKey: "equipment",
    slug: "supply",
    table: "supply_item",
    label: "ทะเบียนคุมวัสดุ",
    icon: "📦",
    description: "รายการวัสดุสิ้นเปลืองที่ต้องควบคุมการเบิกจ่าย",
    defaultSort: "code",
    defaultSortDir: "asc",
    fields: [
      { key: "code", label: "รหัสวัสดุ", type: "text", required: true },
      { key: "name", label: "ชื่อวัสดุ", type: "text", required: true },
      {
        key: "category",
        label: "หมวดหมู่",
        type: "select",
        options: ["วัสดุสำนักงาน", "วัสดุการแพทย์", "วัสดุคอมพิวเตอร์", "วัสดุงานบ้านงานครัว", "วัสดุเชื้อเพลิง", "อื่นๆ"],
      },
      { key: "unit", label: "หน่วยนับ", type: "text" },
      { key: "unit_price", label: "ราคาต่อหน่วย (บาท)", type: "number" },
      { key: "min_qty", label: "จุดสั่งซื้อขั้นต่ำ", type: "number" },
      noteField,
    ],
  },
  {
    key: "equipment/requisition",
    moduleKey: "equipment",
    slug: "requisition",
    table: "supply_requisition",
    label: "ใบเบิกวัสดุ (แบบ 8707)",
    icon: "🧾",
    description: "ใบเบิกวัสดุตามระเบียบพัสดุ — ต้องลงนามครบ 6 ตำแหน่ง",
    defaultSort: "req_date",
    defaultSortDir: "desc",
    printPath: "/print/supply-requisition",
    printLabel: "พิมพ์ใบเบิกวัสดุ",
    fields: [
      { key: "doc_no", label: "เลขที่ใบเบิก", type: "text" },
      { key: "req_date", label: "วันที่เบิก", type: "date", required: true },
      { key: "department", label: "หน่วยงานที่เบิก", type: "text" },
      { key: "purpose", label: "วัตถุประสงค์", type: "text" },
      { key: "status", label: "สถานะ", type: "select", options: REQ_STATUS, badge: true },
      { key: "requester_name", label: "ผู้เบิก", type: "text", required: true },
      { key: "orderer_name", label: "ผู้สั่งจ่าย", type: "text", hideInTable: true },
      { key: "issuer_name", label: "ผู้จ่าย", type: "text", hideInTable: true },
      { key: "receiver_name", label: "ผู้รับของ", type: "text", hideInTable: true },
      { key: "recorder_name", label: "ผู้ลงบัญชี", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "equipment/loan",
    moduleKey: "equipment",
    slug: "loan",
    table: "asset_loan",
    label: "ยืม - คืนพัสดุ",
    icon: "🔄",
    description: "ใบยืมพัสดุพร้อมกำหนดคืน — ระบบเตือนเมื่อเลยกำหนด",
    defaultSort: "loan_date",
    defaultSortDir: "desc",
    printPath: "/print/asset-loan",
    printLabel: "พิมพ์ใบยืมพัสดุ",
    fields: [
      { key: "doc_no", label: "เลขที่", type: "text" },
      {
        key: "asset_id",
        label: "ครุภัณฑ์ที่ยืม",
        type: "lookup",
        lookup: {
          table: "asset",
          labelExpr: "asset_code || ' — ' || name",
          orderBy: "asset_code",
        },
      },
      { key: "item_detail", label: "รายละเอียดเพิ่มเติม", type: "text", hideInTable: true },
      { key: "borrower_name", label: "ผู้ยืม", type: "text", required: true },
      { key: "borrower_dept", label: "หน่วยงาน", type: "text", hideInTable: true },
      { key: "reason", label: "เหตุผลการยืม", type: "textarea", hideInTable: true },
      { key: "loan_date", label: "วันที่ยืม", type: "date", required: true },
      { key: "due_date", label: "กำหนดคืน", type: "date", required: true },
      { key: "returned_date", label: "วันที่คืนจริง", type: "date" },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: ["borrowed", "returned", "overdue"],
        badge: true,
      },
      { key: "return_condition", label: "สภาพเมื่อคืน", type: "text", hideInTable: true },
      { key: "approver_name", label: "ผู้อนุมัติ", type: "text", hideInTable: true },
      { key: "inspector_name", label: "ผู้ตรวจรับคืน", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "equipment/audit",
    moduleKey: "equipment",
    slug: "audit",
    table: "asset_audit",
    label: "ตรวจสอบพัสดุประจำปี",
    icon: "✔️",
    description:
      "ตามระเบียบพัสดุ 2560 — แต่งตั้งก่อนสิ้นปีงบประมาณ เริ่มตรวจวันเปิดทำการวันแรก ให้เสร็จใน 30 วันทำการ และส่งสำเนาให้ สตง.",
    defaultSort: "fiscal_year",
    defaultSortDir: "desc",
    fields: [
      { key: "fiscal_year", label: "ปีงบประมาณ", type: "number", required: true },
      { key: "appointed_date", label: "วันที่แต่งตั้งคณะกรรมการ", type: "date" },
      {
        key: "committee",
        label: "คณะกรรมการตรวจสอบ",
        type: "textarea",
        help: "ตามระเบียบ ผู้ตรวจสอบต้องไม่ใช่เจ้าหน้าที่พัสดุ",
      },
      { key: "start_date", label: "วันเริ่มตรวจ", type: "date" },
      { key: "end_date", label: "วันตรวจเสร็จ", type: "date" },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: ["in_progress", "completed"],
        badge: true,
      },
      { key: "summary", label: "สรุปผลการตรวจสอบ", type: "textarea", hideInTable: true },
      { key: "sent_to_oag_date", label: "วันที่ส่งสำเนาให้ สตง.", type: "date", hideInTable: true },
    ],
  },

  /* ═══════ 6. ระบาดวิทยา ═══════ */
  {
    key: "epidemiology/investigation",
    moduleKey: "epidemiology",
    slug: "investigation",
    table: "outbreak_investigation",
    label: "บันทึกสอบสวนโรค",
    icon: "🔍",
    description: "บันทึกการสอบสวนโรคและมาตรการควบคุมในพื้นที่",
    defaultSort: "investigate_date",
    defaultSortDir: "desc",
    fields: [
      { key: "doc_no", label: "เลขที่", type: "text" },
      { key: "investigate_date", label: "วันที่สอบสวน", type: "date", required: true },
      { key: "disease_name", label: "โรค", type: "text", required: true },
      { key: "area", label: "พื้นที่", type: "text" },
      { key: "case_count", label: "จำนวนผู้ป่วย", type: "number" },
      { key: "contact_count", label: "จำนวนผู้สัมผัส", type: "number" },
      { key: "cause", label: "สาเหตุ/ปัจจัยเสี่ยง", type: "textarea", hideInTable: true },
      { key: "control_measure", label: "มาตรการควบคุม", type: "textarea", hideInTable: true },
      { key: "investigator", label: "ผู้สอบสวน", type: "text" },
      noteField,
    ],
  },
  {
    key: "epidemiology/plan",
    moduleKey: "epidemiology",
    slug: "plan",
    table: "disease_control_plan",
    label: "แผนงานควบคุมโรคประจำปี",
    icon: "🗂️",
    description: "แผนงานและกิจกรรมควบคุมโรคประจำปีงบประมาณ",
    defaultSort: "fiscal_year",
    defaultSortDir: "desc",
    fields: [
      { key: "fiscal_year", label: "ปีงบประมาณ", type: "number", required: true },
      { key: "disease_name", label: "โรคเป้าหมาย", type: "text", required: true },
      { key: "activity", label: "กิจกรรม", type: "textarea" },
      { key: "target_group", label: "กลุ่มเป้าหมาย", type: "text" },
      { key: "budget", label: "งบประมาณ (บาท)", type: "number" },
      { key: "responsible", label: "ผู้รับผิดชอบ", type: "text" },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: ["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น"],
        badge: true,
      },
      { key: "result", label: "ผลการดำเนินงาน", type: "textarea", hideInTable: true },
    ],
  },

  /* ═══════ 7. แผนยุทธศาสตร์ ═══════ */
  {
    key: "strategy/plan",
    moduleKey: "strategy",
    slug: "plan",
    table: "strategic_plan",
    label: "แผนยุทธศาสตร์ประจำปี",
    icon: "🎯",
    description: "ประเด็นยุทธศาสตร์ เป้าประสงค์ และตัวชี้วัด",
    defaultSort: "fiscal_year",
    defaultSortDir: "desc",
    fields: [
      { key: "fiscal_year", label: "ปีงบประมาณ", type: "number", required: true },
      { key: "strategy_name", label: "ประเด็นยุทธศาสตร์", type: "text", required: true },
      { key: "goal", label: "เป้าประสงค์", type: "textarea" },
      { key: "kpi_name", label: "ตัวชี้วัด", type: "text" },
      { key: "kpi_target", label: "ค่าเป้าหมาย", type: "text" },
      { key: "kpi_result", label: "ผลที่ทำได้", type: "text" },
      noteField,
    ],
  },
  {
    key: "strategy/budget",
    moduleKey: "strategy",
    slug: "budget",
    table: "budget_transaction",
    label: "แผนการเงิน / เบิกจ่าย",
    icon: "💰",
    description: "รายการเบิกจ่ายงบประมาณรายโครงการ — ระบบคำนวณยอดคงเหลือให้อัตโนมัติ",
    defaultSort: "txn_date",
    defaultSortDir: "desc",
    fields: [
      {
        key: "project_id",
        label: "โครงการ",
        type: "lookup",
        required: true,
        lookup: {
          table: "project",
          labelExpr: "project_name || ' (ปี ' || fiscal_year || ')'",
          orderBy: "fiscal_year DESC, project_name",
        },
      },
      { key: "txn_date", label: "วันที่เบิกจ่าย", type: "date", required: true },
      { key: "doc_no", label: "เลขที่เอกสาร", type: "text" },
      { key: "detail", label: "รายการ", type: "text", required: true },
      { key: "amount", label: "จำนวนเงิน (บาท)", type: "number", required: true },
      { key: "requester", label: "ผู้เบิก", type: "text" },
      { key: "approver_name", label: "ผู้อนุมัติ", type: "text", hideInTable: true },
      noteField,
    ],
  },

  /* ═══════ 9. อนามัยโรงเรียน ═══════ */
  {
    key: "schoolhealth/checkup",
    moduleKey: "schoolhealth",
    slug: "checkup",
    table: "student_health_check",
    label: "ตรวจสุขภาพนักเรียน",
    icon: "🩺",
    description: "แบบบันทึกการตรวจสุขภาพนักเรียนตามมาตรฐานกรมอนามัย",
    defaultSort: "check_date",
    defaultSortDir: "desc",
    fields: [
      lookupSchool(),
      { key: "academic_year", label: "ปีการศึกษา", type: "text" },
      { key: "term", label: "ภาคเรียน", type: "select", options: ["1", "2"] },
      { key: "class_level", label: "ชั้น", type: "text" },
      { key: "class_room", label: "ห้อง", type: "text", hideInTable: true },
      { key: "student_name", label: "ชื่อ-สกุลนักเรียน", type: "text", required: true },
      { key: "gender", label: "เพศ", type: "select", options: ["ชาย", "หญิง"] },
      { key: "birth_date", label: "วันเกิด", type: "date", hideInTable: true },
      { key: "check_date", label: "วันที่ตรวจ", type: "date" },
      { key: "weight_kg", label: "น้ำหนัก (กก.)", type: "number" },
      { key: "height_cm", label: "ส่วนสูง (ซม.)", type: "number" },
      {
        key: "nutrition_status",
        label: "ภาวะโภชนาการ",
        type: "select",
        options: ["สมส่วน", "ผอม", "ค่อนข้างผอม", "ท้วม", "เริ่มอ้วน", "อ้วน", "เตี้ย"],
        badge: true,
      },
      { key: "vision_result", label: "สายตา", type: "select", options: ["ปกติ", "ผิดปกติ"], hideInTable: true },
      { key: "hearing_result", label: "การได้ยิน", type: "select", options: ["ปกติ", "ผิดปกติ"], hideInTable: true },
      { key: "oral_result", label: "ช่องปาก/ฟัน", type: "select", options: ["ปกติ", "ฟันผุ", "เหงือกอักเสบ", "อื่นๆ"], hideInTable: true },
      { key: "lice_result", label: "เหา", type: "select", options: ["ไม่พบ", "พบ"], hideInTable: true },
      { key: "skin_result", label: "ผิวหนัง", type: "select", options: ["ปกติ", "ผิดปกติ"], hideInTable: true },
      { key: "nail_result", label: "เล็บ", type: "select", options: ["สะอาด", "ไม่สะอาด"], hideInTable: true },
      { key: "hygiene_result", label: "ความสะอาดร่างกาย", type: "select", options: ["ดี", "พอใช้", "ควรปรับปรุง"], hideInTable: true },
      { key: "referral", label: "การส่งต่อ", type: "text", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "schoolhealth/vaccine",
    moduleKey: "schoolhealth",
    slug: "vaccine",
    table: "school_vaccination",
    label: "วัคซีนในโรงเรียน",
    icon: "💉",
    description: "การให้วัคซีนนักเรียนและความครอบคลุม — ระบบคำนวณ % ให้อัตโนมัติ",
    defaultSort: "vaccine_date",
    defaultSortDir: "desc",
    fields: [
      lookupSchool(),
      { key: "academic_year", label: "ปีการศึกษา", type: "text" },
      { key: "class_level", label: "ชั้นปี", type: "select", options: ["ป.1", "ป.5", "ป.6", "ม.1", "อื่นๆ"] },
      {
        key: "vaccine_name",
        label: "ชนิดวัคซีน",
        type: "select",
        required: true,
        options: ["MMR", "dT", "HPV", "OPV", "BCG", "ไข้หวัดใหญ่", "อื่นๆ"],
      },
      { key: "vaccine_date", label: "วันที่ให้วัคซีน", type: "date" },
      { key: "target_count", label: "นักเรียนเป้าหมาย", type: "number" },
      { key: "received_count", label: "ได้รับวัคซีน", type: "number" },
      { key: "coverage_pct", label: "ความครอบคลุม (%)", type: "number", computed: true },
      noteField,
    ],
  },
  {
    key: "schoolhealth/activity",
    moduleKey: "schoolhealth",
    slug: "activity",
    table: "health_education_activity",
    label: "กิจกรรมสุขศึกษา",
    icon: "📣",
    description: "กิจกรรมสุขศึกษาและส่งเสริมสุขภาพในโรงเรียน",
    defaultSort: "activity_date",
    defaultSortDir: "desc",
    fields: [
      lookupSchool(false),
      { key: "activity_name", label: "ชื่อกิจกรรม", type: "text", required: true },
      { key: "activity_date", label: "วันที่จัด", type: "date" },
      { key: "target_group", label: "กลุ่มเป้าหมาย", type: "text" },
      { key: "participant_count", label: "จำนวนผู้เข้าร่วม", type: "number" },
      { key: "organizer", label: "ผู้ดำเนินการ", type: "text" },
      { key: "result", label: "ผลการดำเนินงาน", type: "textarea", hideInTable: true },
    ],
  },

  /* ═══════ 10. อสม. / ประชุม ═══════ */
  {
    key: "vhv/meeting",
    moduleKey: "vhv",
    slug: "meeting",
    table: "vhv_meeting",
    label: "ระบบประชุม อสม.",
    icon: "📅",
    description: "การประชุม อสม. ประจำเดือน วาระ และมติที่ประชุม",
    defaultSort: "meeting_date",
    defaultSortDir: "desc",
    printPath: "/print/vhv-meeting",
    printLabel: "พิมพ์รายงานการประชุม",
    fields: [
      { key: "meeting_no", label: "ครั้งที่", type: "text" },
      { key: "meeting_date", label: "วันที่ประชุม", type: "date", required: true },
      { key: "location", label: "สถานที่", type: "text" },
      { key: "chairman_name", label: "ประธานที่ประชุม", type: "text" },
      { key: "agenda", label: "วาระการประชุม", type: "textarea", hideInTable: true },
      { key: "resolution", label: "มติที่ประชุม", type: "textarea", hideInTable: true },
      { key: "recorder_name", label: "ผู้บันทึกการประชุม", type: "text" },
      noteField,
    ],
  },
  {
    key: "vhv/performance",
    moduleKey: "vhv",
    slug: "performance",
    table: "vhv_performance",
    label: "รายงานผลงาน อสม.",
    icon: "📊",
    description: "รายงานผลงาน อสม. รายเดือน ประกอบการเบิกค่าป่วยการ",
    defaultSort: "report_year",
    defaultSortDir: "desc",
    fields: [
      lookupVhv(),
      { key: "report_year", label: "ปี (พ.ศ.)", type: "number", required: true },
      {
        key: "report_month",
        label: "เดือน",
        type: "select",
        required: true,
        options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      },
      { key: "visit_count", label: "จำนวนครัวเรือนที่เยี่ยม", type: "number" },
      { key: "activity", label: "กิจกรรมที่ดำเนินการ", type: "textarea" },
      { key: "highlight", label: "ผลงานเด่น", type: "textarea", hideInTable: true },
    ],
  },
  /* ═══════ 6b. ระบาดวิทยา — พื้นที่ระบาด ═══════ */
  {
    key: "epidemiology/area",
    moduleKey: "epidemiology",
    slug: "area",
    table: "outbreak_area",
    label: "พื้นที่ระบาด",
    icon: "🗺️",
    description:
      "ติดตามหมู่บ้าน/ชุมชนที่กำลังมีการระบาด พร้อมอัตราป่วยต่อประชากรพันคน (ระบบคำนวณให้)",
    defaultSort: "last_case_date",
    defaultSortDir: "desc",
    fields: [
      { key: "area_name", label: "พื้นที่ / ชุมชน", type: "text", required: true },
      { key: "village_no", label: "หมู่ที่", type: "text" },
      { key: "disease_name", label: "โรคที่ระบาด", type: "text", required: true },
      { key: "first_case_date", label: "ผู้ป่วยรายแรก", type: "date" },
      { key: "last_case_date", label: "ผู้ป่วยรายล่าสุด", type: "date" },
      { key: "case_count", label: "จำนวนผู้ป่วย (ราย)", type: "number" },
      { key: "population", label: "ประชากรในพื้นที่", type: "number", hideInTable: true },
      {
        key: "attack_rate",
        label: "อัตราป่วยต่อพันประชากร",
        type: "number",
        computed: true,
        help: "ระบบคำนวณจาก จำนวนผู้ป่วย ÷ ประชากร × 1,000",
      },
      {
        key: "risk_level",
        label: "ระดับความเสี่ยง",
        type: "select",
        options: ["ต่ำ", "ปานกลาง", "สูง", "สูงมาก"],
        badge: true,
      },
      {
        key: "status",
        label: "สถานะ",
        type: "select",
        options: ["กำลังระบาด", "เฝ้าระวัง", "ควบคุมได้", "ยุติการระบาด"],
        badge: true,
      },
      { key: "measure", label: "มาตรการควบคุมโรค", type: "textarea", hideInTable: true },
      { key: "responsible", label: "ผู้รับผิดชอบ", type: "text", hideInTable: true },
      noteField,
    ],
  },

  /* ═══════ 7b. ยุทธศาสตร์ — รายงานผลโครงการ ═══════ */
  {
    key: "strategy/report",
    moduleKey: "strategy",
    slug: "report",
    table: "project_report",
    label: "รายงานผลโครงการ",
    icon: "📈",
    description:
      "รายงานผลการดำเนินงานรายโครงการ ระบบคำนวณร้อยละความสำเร็จจากเป้าหมายและผลงานจริงให้อัตโนมัติ",
    defaultSort: "report_date",
    defaultSortDir: "desc",
    printPath: "/print/project-report",
    printLabel: "พิมพ์รายงานผลโครงการ",
    fields: [
      {
        key: "project_id",
        label: "โครงการ",
        type: "lookup",
        required: true,
        lookup: {
          table: "project",
          labelExpr: "project_name || ' (ปี ' || fiscal_year || ')'",
          orderBy: "fiscal_year DESC, project_name",
        },
      },
      { key: "report_date", label: "วันที่รายงาน", type: "date", required: true },
      {
        key: "period",
        label: "รอบรายงาน",
        type: "select",
        options: ["ไตรมาส 1", "ไตรมาส 2", "ไตรมาส 3", "ไตรมาส 4", "รายปี"],
      },
      { key: "target_count", label: "เป้าหมาย", type: "number" },
      { key: "actual_count", label: "ผลงานจริง", type: "number" },
      {
        key: "achievement_pct",
        label: "ร้อยละความสำเร็จ",
        type: "number",
        computed: true,
        help: "ระบบคำนวณจาก ผลงานจริง ÷ เป้าหมาย × 100",
      },
      { key: "budget_used", label: "งบที่ใช้ไป (บาท)", type: "number" },
      { key: "activity_summary", label: "สรุปกิจกรรมที่ดำเนินการ", type: "textarea" },
      { key: "problem", label: "ปัญหา / อุปสรรค", type: "textarea", hideInTable: true },
      { key: "suggestion", label: "ข้อเสนอแนะ", type: "textarea", hideInTable: true },
      { key: "reporter", label: "ผู้รายงาน", type: "text", hideInTable: true },
      noteField,
    ],
  },

  /* ═══════ 8b. PCU — หลักฐานประกอบ ═══════ */
  {
    key: "pcu/evidence",
    moduleKey: "pcu",
    slug: "evidence",
    table: "pcu_evidence",
    label: "หลักฐานประกอบ",
    icon: "📎",
    description:
      "ทะเบียนหลักฐานที่ใช้ยืนยันการผ่านเกณฑ์แต่ละข้อ แนบไฟล์เอกสาร/ภาพถ่ายได้ที่ปุ่ม 📎 ท้ายรายการ",
    defaultSort: "doc_date",
    defaultSortDir: "desc",
    fields: [
      {
        key: "fiscal_year",
        label: "ปีงบประมาณ",
        type: "number",
        required: true,
        help: "เช่น 2569",
      },
      {
        key: "criteria_id",
        label: "เกณฑ์ข้อที่",
        type: "lookup",
        required: true,
        lookup: {
          table: "pcu_criteria",
          labelExpr: "item_no || ' ' || item_name",
          orderBy: "sort_order",
        },
      },
      { key: "evidence_name", label: "ชื่อหลักฐาน", type: "text", required: true },
      {
        key: "evidence_type",
        label: "ประเภทหลักฐาน",
        type: "select",
        options: [
          "เอกสาร",
          "ภาพถ่าย",
          "คำสั่งแต่งตั้ง",
          "รายงานการประชุม",
          "แผน / โครงการ",
          "ทะเบียน / บันทึก",
          "อื่น ๆ",
        ],
      },
      { key: "doc_date", label: "วันที่ของเอกสาร", type: "date" },
      { key: "location", label: "จัดเก็บไว้ที่", type: "text" },
      { key: "responsible", label: "ผู้รับผิดชอบ", type: "text", hideInTable: true },
      noteField,
    ],
  },

  /* ═══════ 10b. อสม. — เขตรับผิดชอบ / บันทึกการเข้าร่วมประชุม ═══════ */
  {
    key: "vhv/area",
    moduleKey: "vhv",
    slug: "area",
    table: "vhv_area",
    label: "เขตรับผิดชอบ",
    icon: "🏘️",
    description: "พื้นที่และจำนวนหลังคาเรือนที่ อสม. แต่ละคนรับผิดชอบ",
    defaultSort: "village_no",
    defaultSortDir: "asc",
    fields: [
      lookupVhv(true),
      { key: "village_no", label: "หมู่ที่", type: "text" },
      { key: "village_name", label: "ชื่อหมู่บ้าน", type: "text" },
      { key: "household_count", label: "หลังคาเรือน", type: "number" },
      { key: "population_count", label: "ประชากร", type: "number" },
      { key: "elderly_count", label: "ผู้สูงอายุ", type: "number", hideInTable: true },
      { key: "chronic_count", label: "ผู้ป่วยเรื้อรัง", type: "number", hideInTable: true },
      { key: "disabled_count", label: "ผู้พิการ", type: "number", hideInTable: true },
      { key: "zone_detail", label: "รายละเอียดเขต", type: "textarea", hideInTable: true },
      noteField,
    ],
  },
  {
    key: "vhv/attendance",
    moduleKey: "vhv",
    slug: "attendance",
    table: "vhv_attendance",
    label: "บันทึกการเข้าร่วมประชุม",
    icon: "✅",
    description:
      "บันทึกการมาประชุมของ อสม. รายคน — อสม. หนึ่งคนบันทึกได้ครั้งเดียวต่อการประชุมหนึ่งครั้ง",
    defaultSort: "id",
    defaultSortDir: "desc",
    fields: [
      {
        key: "meeting_id",
        label: "การประชุม",
        type: "lookup",
        required: true,
        lookup: {
          table: "vhv_meeting",
          labelExpr:
            "COALESCE(meeting_no, 'ครั้งที่ -') || ' วันที่ ' || to_char(meeting_date, 'DD/MM/YYYY')",
          orderBy: "meeting_date DESC",
        },
      },
      lookupVhv(true),
      {
        key: "status",
        label: "การเข้าร่วม",
        type: "select",
        required: true,
        options: ["มา", "มาสาย", "ลา", "ขาด"],
        badge: true,
      },
      noteField,
    ],
  },

];

export const SUBTABLES: Record<string, SubTableDef> = Object.fromEntries(
  SUB_LIST.map((s) => [s.key, s]),
);

export function getSubTable(moduleKey: string, slug: string): SubTableDef | null {
  const key = `${moduleKey}/${slug}`;
  return Object.prototype.hasOwnProperty.call(SUBTABLES, key) ? SUBTABLES[key] : null;
}

/** ค้นหาจากชื่อตารางที่ API ส่งมา (ใช้ตรวจสิทธิ์) */
export function getSubTableByKey(key: string): SubTableDef | null {
  return Object.prototype.hasOwnProperty.call(SUBTABLES, key) ? SUBTABLES[key] : null;
}

/** ตารางที่อนุญาตให้ดึงเป็นตัวเลือก lookup ได้ */
export const LOOKUP_WHITELIST: Record<string, { labelExpr: string; orderBy: string }> = {
  personnel: {
    labelExpr: "COALESCE(prefix,'') || first_name || ' ' || last_name",
    orderBy: "first_name",
  },
  vehicle: { labelExpr: "plate || ' — ' || COALESCE(vehicle_name,'')", orderBy: "plate" },
  school: { labelExpr: "school_name", orderBy: "school_name" },
  vhv: {
    labelExpr: "COALESCE(prefix,'') || first_name || ' ' || last_name",
    orderBy: "first_name",
  },
  asset: { labelExpr: "asset_code || ' — ' || name", orderBy: "asset_code" },
  project: {
    labelExpr: "project_name || ' (ปี ' || fiscal_year || ')'",
    orderBy: "fiscal_year DESC, project_name",
  },
  vhv_meeting: {
    labelExpr:
      "COALESCE(meeting_no, 'ครั้งที่ -') || ' วันที่ ' || to_char(meeting_date, 'DD/MM/YYYY')",
    orderBy: "meeting_date DESC",
  },
  pcu_criteria: { labelExpr: "item_no || ' ' || item_name", orderBy: "sort_order" },
  inventory_item: {
    labelExpr: "code || ' — ' || COALESCE(trade_name, generic_name)",
    orderBy: "code",
  },
  supply_item: { labelExpr: "code || ' — ' || name", orderBy: "code" },
};
