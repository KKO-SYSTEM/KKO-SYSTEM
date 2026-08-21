/**
 * Module registry — นิยามตารางหลักของแต่ละระบบงาน
 *
 * ใช้กับหน้าตาราง/ฟอร์ม/ค้นหา/Export ที่ใช้โค้ดร่วมกันทุกโมดูล
 * ส่วนงานที่มี workflow เฉพาะ (ใบลา ใบเบิก Stock Card ฯลฯ)
 * มีหน้าจอและ API ของตัวเองแยกต่างหาก
 */

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "time"
  | "select"
  | "textarea"
  | "lookup";

/** ตัวเลือกที่ดึงจากตารางอื่น เช่น เลือกรถจากทะเบียนรถ */
export interface LookupConfig {
  /** ชื่อตารางที่ไปดึงตัวเลือก */
  table: string;
  /** นิพจน์ SQL สำหรับข้อความที่แสดง เช่น "plate || ' — ' || vehicle_name" */
  labelExpr: string;
  /** เงื่อนไขกรองเพิ่มเติม เช่น { column: 'status', value: 'ปฏิบัติงาน' } */
  filter?: { column: string; value: string };
  orderBy?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  badge?: boolean;
  hideInTable?: boolean;
  /** ระบบคำนวณให้ ผู้ใช้แก้ไม่ได้ */
  computed?: boolean;
  help?: string;
  lookup?: LookupConfig;
}

export interface SubPage {
  slug: string;
  label: string;
  icon?: string;
}

export interface ModuleDef {
  key: string;
  table: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  /** เมนูย่อยตามโปสเตอร์ */
  subPages: SubPage[];
  fields: FieldDef[];
  defaultSort: string;
  defaultSortDir: "asc" | "desc";
  /** กรองแถวตาม kind (ใช้กับคลังยา/วัคซีนที่ใช้ตารางร่วมกัน) */
  fixedFilter?: { column: string; value: string };
}

const STATUS_PERSON = ["ปฏิบัติงาน", "ลา", "ย้าย/ลาออก", "เกษียณ"];

export const MODULES: Record<string, ModuleDef> = {
  /* ─────────── 1. ระบบบุคลากร ─────────── */
  personnel: {
    key: "personnel",
    table: "personnel",
    label: "ระบบบุคลากร",
    shortLabel: "บุคลากร",
    icon: "🧑‍⚕️",
    description: "โครงสร้างบุคลากร ตารางเวร ระบบลาตามระเบียบข้าราชการ และรายงานสรุปวันลา",
    subPages: [
      { slug: "", label: "โครงสร้างบุคลากร", icon: "👥" },
      { slug: "roster", label: "จัดการตารางเวร", icon: "📅" },
      { slug: "leave", label: "ระบบการลา", icon: "📝" },
      { slug: "leave-summary", label: "รายงานสรุปวันลา", icon: "📊" },
    ],
    defaultSort: "first_name",
    defaultSortDir: "asc",
    fields: [
      { key: "prefix", label: "คำนำหน้า", type: "select", options: ["นาย", "นาง", "นางสาว", "แพทย์หญิง", "นายแพทย์"] },
      { key: "first_name", label: "ชื่อ", type: "text", required: true },
      { key: "last_name", label: "นามสกุล", type: "text", required: true },
      { key: "citizen_id", label: "เลขประจำตัวประชาชน", type: "text", hideInTable: true },
      { key: "position", label: "ตำแหน่ง", type: "text" },
      {
        key: "person_type",
        label: "ประเภทบุคลากร",
        type: "select",
        options: ["ข้าราชการ", "พนักงานราชการ", "พนักงานกระทรวงสาธารณสุข", "ลูกจ้างประจำ", "ลูกจ้างชั่วคราว"],
      },
      { key: "level", label: "ระดับ", type: "text", hideInTable: true },
      {
        key: "department",
        label: "กลุ่มงาน",
        type: "select",
        options: ["งานบริหาร", "งานบริการปฐมภูมิ", "งานเวชปฏิบัติครอบครัว", "งานส่งเสริมสุขภาพ", "งานเภสัชกรรม", "งานธุรการ/การเงิน"],
      },
      { key: "start_date", label: "วันเริ่มราชการ", type: "date" },
      { key: "phone", label: "เบอร์โทร", type: "text" },
      { key: "email", label: "อีเมล", type: "text", hideInTable: true },
      { key: "status", label: "สถานะ", type: "select", options: STATUS_PERSON, badge: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 2. ระบบคลังยา ─────────── */
  pharmacy: {
    key: "pharmacy",
    table: "inventory_item",
    label: "ระบบคลังยา",
    shortLabel: "คลังยา",
    icon: "💊",
    description: "ทะเบียนรายการยา ใบเบิกยา ทะเบียนรับ-จ่าย (รบ.301) Stock Card และคลังใน/คลังนอก",
    fixedFilter: { column: "kind", value: "drug" },
    subPages: [
      { slug: "", label: "ทะเบียนรายการยา", icon: "💊" },
      { slug: "requisition", label: "ใบเบิกยา", icon: "🧾" },
      { slug: "stockcard", label: "Stock Card", icon: "📇" },
      { slug: "ledger", label: "ทะเบียนรับ-จ่าย (รบ.301)", icon: "📒" },
      { slug: "import", label: "นำเข้า Invoice จาก รพ.แม่ข่าย", icon: "📥" },
      { slug: "alerts", label: "ยาใกล้หมดอายุ / ต่ำกว่าเกณฑ์", icon: "⚠️" },
    ],
    defaultSort: "code",
    defaultSortDir: "asc",
    fields: [
      { key: "code", label: "รหัสยา", type: "text", required: true },
      { key: "generic_name", label: "ชื่อสามัญ", type: "text", required: true },
      { key: "trade_name", label: "ชื่อการค้า/ชื่อไทย", type: "text" },
      { key: "strength", label: "ความแรง", type: "text" },
      {
        key: "dosage_form",
        label: "รูปแบบ",
        type: "select",
        options: ["เม็ด", "แคปซูล", "ยาน้ำ", "ผง", "ครีม/ขี้ผึ้ง", "ฉีด", "หยอด", "อื่นๆ"],
      },
      { key: "unit", label: "หน่วยนับ", type: "select", options: ["เม็ด", "แคปซูล", "ขวด", "หลอด", "ซอง", "แผง", "ชิ้น", "โดส"] },
      { key: "category", label: "ประเภท", type: "select", options: ["ยาในบัญชียาหลัก", "ยานอกบัญชียาหลัก", "เวชภัณฑ์มิใช่ยา", "ยาสมุนไพร"] },
      { key: "unit_price", label: "ราคาต่อหน่วย (บาท)", type: "number", hideInTable: true },
      { key: "min_qty", label: "จุดสั่งซื้อขั้นต่ำ", type: "number", help: "ระบบจะเตือนเมื่อคงเหลือต่ำกว่าค่านี้" },
      { key: "max_qty", label: "จุดสูงสุด", type: "number", hideInTable: true },
      { key: "storage_temp", label: "การจัดเก็บ", type: "text", hideInTable: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 3. ระบบคลังวัคซีน ─────────── */
  vaccine: {
    key: "vaccine",
    table: "inventory_item",
    label: "ระบบคลังวัคซีน",
    shortLabel: "คลังวัคซีน",
    icon: "💉",
    description: "ทะเบียนวัคซีน ใบเบิกวัคซีน Stock Card ระบบลูกโซ่ความเย็น และคลังใน/คลังนอก",
    fixedFilter: { column: "kind", value: "vaccine" },
    subPages: [
      { slug: "", label: "ทะเบียนรายการวัคซีน", icon: "💉" },
      { slug: "requisition", label: "ใบเบิกวัคซีน", icon: "🧾" },
      { slug: "stockcard", label: "Stock Card", icon: "📇" },
      { slug: "ledger", label: "ทะเบียนรับ-จ่าย (รบ.301)", icon: "📒" },
      { slug: "coldchain", label: "บันทึกอุณหภูมิตู้เย็น", icon: "🌡️" },
      { slug: "import", label: "นำเข้า Invoice จาก รพ.แม่ข่าย", icon: "📥" },
      { slug: "alerts", label: "วัคซีนใกล้หมดอายุ", icon: "⚠️" },
    ],
    defaultSort: "code",
    defaultSortDir: "asc",
    fields: [
      { key: "code", label: "รหัสวัคซีน", type: "text", required: true },
      { key: "generic_name", label: "ชื่อวัคซีน (อังกฤษ)", type: "text", required: true },
      { key: "trade_name", label: "ชื่อวัคซีน (ไทย)", type: "text" },
      { key: "dosage_form", label: "วิธีให้", type: "select", options: ["ฉีด", "หยอด", "พ่น"] },
      { key: "unit", label: "หน่วยนับ", type: "select", options: ["โดส", "ขวด", "หลอด"] },
      { key: "category", label: "ประเภท", type: "select", options: ["วัคซีน EPI", "วัคซีนตามฤดูกาล", "วัคซีนเฉพาะกลุ่ม", "อื่นๆ"] },
      { key: "storage_temp", label: "อุณหภูมิจัดเก็บ", type: "select", options: ["2-8°C", "-15 ถึง -25°C", "-60 ถึง -80°C"] },
      { key: "min_qty", label: "จุดสั่งซื้อขั้นต่ำ (โดส)", type: "number" },
      { key: "max_qty", label: "จุดสูงสุด (โดส)", type: "number", hideInTable: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 4. ระบบยานพาหนะ ─────────── */
  vehicle: {
    key: "vehicle",
    table: "vehicle",
    label: "ระบบยานพาหนะ",
    shortLabel: "ยานพาหนะ",
    icon: "🚑",
    description: "ทะเบียนรถ ใบขออนุญาตใช้รถ (แบบ 3) บันทึกการใช้รถ (แบบ 4) การเบิกน้ำมัน และประวัติซ่อมบำรุง",
    subPages: [
      { slug: "", label: "ทะเบียนรถ", icon: "🚗" },
      { slug: "request", label: "ใบขออนุญาตใช้รถ (แบบ 3)", icon: "📋" },
      { slug: "log", label: "บันทึกการใช้รถ (แบบ 4)", icon: "🛣️" },
      { slug: "fuel", label: "การเบิกน้ำมันเชื้อเพลิง", icon: "⛽" },
      { slug: "maintenance", label: "ประวัติซ่อมบำรุง (แบบ 6)", icon: "🔧" },
    ],
    defaultSort: "plate",
    defaultSortDir: "asc",
    fields: [
      { key: "seq_no", label: "ลำดับที่", type: "text" },
      { key: "vehicle_name", label: "ชื่อของรถ", type: "text", required: true },
      { key: "model", label: "แบบ/รุ่น/ปี", type: "text" },
      { key: "engine_size", label: "ขนาด (ซีซี)", type: "text", hideInTable: true },
      { key: "plate", label: "หมายเลขทะเบียน", type: "text", required: true },
      { key: "vehicle_type", label: "ประเภท", type: "select", options: ["รถพยาบาล", "รถยนต์ส่วนกลาง", "รถตู้", "จักรยานยนต์", "อื่นๆ"] },
      { key: "department", label: "สังกัดหน่วยงาน", type: "text", hideInTable: true },
      { key: "price", label: "ราคา (บาท)", type: "number", hideInTable: true },
      { key: "acquired_date", label: "วันได้มา", type: "date" },
      { key: "current_mileage", label: "เลขไมล์ล่าสุด (กม.)", type: "number" },
      { key: "status", label: "สถานะ", type: "select", options: ["พร้อมใช้งาน", "ซ่อมบำรุง", "ไม่พร้อมใช้งาน", "จำหน่ายแล้ว"], badge: true },
      { key: "disposed_date", label: "วันจำหน่าย", type: "date", hideInTable: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 5. ระบบครุภัณฑ์ / พัสดุ ─────────── */
  equipment: {
    key: "equipment",
    table: "asset",
    label: "ระบบครุภัณฑ์ / พัสดุ",
    shortLabel: "ครุภัณฑ์ / พัสดุ",
    icon: "🖥️",
    description: "ทะเบียนคุมทรัพย์สิน รับเข้า-เบิกจ่าย ยืม-คืน ซ่อม/จำหน่าย และตรวจนับประจำปี",
    subPages: [
      { slug: "", label: "ทะเบียนคุมทรัพย์สิน", icon: "📗" },
      { slug: "supply", label: "ทะเบียนคุมวัสดุ", icon: "📦" },
      { slug: "requisition", label: "ใบเบิกวัสดุ (แบบ 8707)", icon: "🧾" },
      { slug: "loan", label: "ยืม - คืนพัสดุ", icon: "🔄" },
      { slug: "audit", label: "ตรวจสอบพัสดุประจำปี", icon: "✔️" },
    ],
    defaultSort: "asset_code",
    defaultSortDir: "asc",
    fields: [
      { key: "asset_code", label: "เลขรหัสพัสดุ", type: "text", required: true },
      { key: "asset_type", label: "ประเภท", type: "select", options: ["ครุภัณฑ์สำนักงาน", "ครุภัณฑ์การแพทย์", "คอมพิวเตอร์/IT", "ยานพาหนะ", "อาคาร/สิ่งปลูกสร้าง", "อื่นๆ"] },
      { key: "name", label: "รายการ", type: "text", required: true },
      { key: "brand_model", label: "ยี่ห้อ/รุ่น", type: "text" },
      { key: "serial_no", label: "หมายเลขเครื่อง", type: "text", hideInTable: true },
      { key: "acquired_date", label: "วันที่ได้มา", type: "date" },
      { key: "doc_no", label: "เลขที่เอกสาร", type: "text", hideInTable: true },
      { key: "fund_source", label: "แหล่งเงิน", type: "select", options: ["เงินงบประมาณ", "เงินบำรุง", "เงินบริจาค", "งบ กปท.", "อื่นๆ"], hideInTable: true },
      { key: "acquire_method", label: "วิธีการได้มา", type: "select", options: ["จัดซื้อ", "จัดจ้าง", "รับบริจาค", "โอนมา"], hideInTable: true },
      { key: "unit_price", label: "ราคาต่อหน่วย (บาท)", type: "number" },
      { key: "unit_count", label: "จำนวนหน่วย", type: "number", hideInTable: true },
      { key: "useful_life_years", label: "อายุการใช้งาน (ปี)", type: "number", hideInTable: true },
      { key: "annual_depreciation", label: "ค่าเสื่อมราคาต่อปี", type: "number", computed: true, hideInTable: true },
      { key: "accum_depreciation", label: "ค่าเสื่อมราคาสะสม", type: "number", computed: true, hideInTable: true },
      { key: "net_value", label: "มูลค่าสุทธิ (บาท)", type: "number", computed: true },
      { key: "location", label: "ที่เก็บ", type: "text" },
      { key: "responsible_person", label: "ผู้รับผิดชอบ", type: "text", hideInTable: true },
      { key: "condition_status", label: "สภาพ", type: "select", options: ["ดี", "ชำรุด", "รอซ่อม", "เสื่อมสภาพ", "จำหน่ายแล้ว"], badge: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 6. ระบบงานระบาดวิทยา ─────────── */
  epidemiology: {
    key: "epidemiology",
    table: "disease_case",
    label: "ระบบงานระบาดวิทยา",
    shortLabel: "ระบาดวิทยา",
    icon: "🦠",
    description: "ทะเบียนผู้ป่วยโรคติดต่อ (รง.506) บันทึกสอบสวนโรค แผนควบคุมโรค และพื้นที่ระบาด",
    subPages: [
      { slug: "", label: "ทะเบียนผู้ป่วยโรคติดต่อ (รง.506)", icon: "🧾" },
      { slug: "investigation", label: "บันทึกสอบสวนโรค", icon: "🔍" },
      { slug: "plan", label: "แผนงานควบคุมโรคประจำปี", icon: "🗂️" },
      { slug: "area", label: "พื้นที่ระบาด", icon: "🗺️" },
      { slug: "summary", label: "สรุปรายเดือน / รายปี", icon: "📊" },
    ],
    defaultSort: "onset_date",
    defaultSortDir: "desc",
    fields: [
      { key: "report_no", label: "เลขที่บัตรรายงาน", type: "text" },
      { key: "patient_name", label: "ชื่อ-สกุลผู้ป่วย", type: "text", required: true },
      { key: "citizen_id", label: "เลขประจำตัวประชาชน", type: "text", hideInTable: true },
      { key: "gender", label: "เพศ", type: "select", options: ["ชาย", "หญิง"] },
      { key: "age_year", label: "อายุ (ปี)", type: "number" },
      { key: "age_month", label: "อายุ (เดือน)", type: "number", hideInTable: true },
      { key: "nationality", label: "สัญชาติ", type: "text", hideInTable: true },
      { key: "occupation", label: "อาชีพ", type: "text", hideInTable: true },
      { key: "disease_code", label: "รหัสโรค (506)", type: "text", hideInTable: true },
      { key: "disease_name", label: "ชื่อโรค", type: "select", required: true, options: ["ไข้เลือดออก", "ไข้หวัดใหญ่", "มือ เท้า ปาก", "โควิด-19", "อุจจาระร่วง", "วัณโรค", "ไข้ไม่ทราบสาเหตุ", "อาหารเป็นพิษ", "ตาแดง", "อื่นๆ"] },
      { key: "onset_date", label: "วันเริ่มป่วย", type: "date", required: true },
      { key: "treat_date", label: "วันที่รักษา", type: "date", hideInTable: true },
      { key: "admit_date", label: "วันที่รับรักษา", type: "date", hideInTable: true },
      { key: "house_no", label: "บ้านเลขที่", type: "text", hideInTable: true },
      { key: "village_no", label: "หมู่ที่", type: "text", hideInTable: true },
      { key: "village_name", label: "หมู่บ้าน", type: "text" },
      { key: "subdistrict", label: "ตำบล", type: "text", hideInTable: true },
      { key: "district", label: "อำเภอ", type: "text", hideInTable: true },
      { key: "province", label: "จังหวัด", type: "text", hideInTable: true },
      { key: "patient_type", label: "ประเภทผู้ป่วย", type: "select", options: ["ผู้ป่วยนอก", "ผู้ป่วยใน"] },
      { key: "treat_result", label: "ผลการรักษา", type: "select", options: ["หาย", "กำลังรักษา", "ส่งต่อ", "ตาย", "ไม่ทราบ"], badge: true },
      { key: "reporter_name", label: "ผู้รายงาน", type: "text", hideInTable: true },
      { key: "report_date", label: "วันที่รายงาน", type: "date", hideInTable: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 7. ระบบแผนยุทธศาสตร์ ─────────── */
  strategy: {
    key: "strategy",
    table: "project",
    label: "ระบบแผนยุทธศาสตร์",
    shortLabel: "แผนยุทธศาสตร์",
    icon: "🎯",
    description: "แผนยุทธศาสตร์ประจำปี แผนงาน/โครงการ งบประมาณที่ได้รับ เบิกจ่าย-คงเหลือ และรายงานผล",
    subPages: [
      { slug: "", label: "แผนงาน / โครงการ", icon: "📋" },
      { slug: "plan", label: "แผนยุทธศาสตร์ประจำปี", icon: "🎯" },
      { slug: "budget", label: "แผนการเงิน / เบิกจ่าย", icon: "💰" },
      { slug: "report", label: "รายงานผลโครงการ", icon: "📊" },
    ],
    defaultSort: "fiscal_year",
    defaultSortDir: "desc",
    fields: [
      { key: "project_code", label: "รหัสโครงการ", type: "text" },
      { key: "project_name", label: "ชื่อโครงการ", type: "text", required: true },
      { key: "fiscal_year", label: "ปีงบประมาณ", type: "number", required: true },
      { key: "responsible", label: "ผู้รับผิดชอบ", type: "text" },
      { key: "rationale", label: "หลักการและเหตุผล", type: "textarea", hideInTable: true },
      { key: "objective", label: "วัตถุประสงค์", type: "textarea", hideInTable: true },
      { key: "target_group", label: "กลุ่มเป้าหมาย", type: "text", hideInTable: true },
      { key: "target_count", label: "จำนวนเป้าหมาย", type: "number", hideInTable: true },
      { key: "method", label: "วิธีดำเนินการ", type: "textarea", hideInTable: true },
      { key: "start_date", label: "วันเริ่ม", type: "date", hideInTable: true },
      { key: "end_date", label: "วันสิ้นสุด", type: "date", hideInTable: true },
      { key: "budget", label: "งบประมาณที่ได้รับ (บาท)", type: "number" },
      { key: "fund_source", label: "แหล่งงบประมาณ", type: "select", options: ["งบ สปสช.", "งบ กปท.", "งบ อบต./เทศบาล", "เงินบำรุง", "เงินงบประมาณ", "อื่นๆ"] },
      { key: "expected_result", label: "ผลที่คาดว่าจะได้รับ", type: "textarea", hideInTable: true },
      { key: "result_summary", label: "สรุปผลการดำเนินงาน", type: "textarea", hideInTable: true },
      { key: "status", label: "สถานะ", type: "select", options: ["ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น", "ยกเลิก"], badge: true },
    ],
  },

  /* ─────────── 8. มาตรฐานหน่วยบริการ PCU ─────────── */
  pcu: {
    key: "pcu",
    table: "pcu_criteria",
    label: "งานมาตรฐานหน่วยบริการ PCU",
    shortLabel: "มาตรฐาน PCU",
    icon: "✅",
    description: "เกณฑ์คุณภาพมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566 — 8 หมวด 253 คะแนน",
    subPages: [
      { slug: "", label: "Checklist มาตรฐาน", icon: "☑️" },
      { slug: "evidence", label: "หลักฐานประกอบ", icon: "📎" },
      { slug: "score", label: "คะแนนประเมิน", icon: "💯" },
      { slug: "readiness", label: "รายงานเตรียมรับประเมิน", icon: "📄" },
    ],
    defaultSort: "sort_order",
    defaultSortDir: "asc",
    fields: [
      { key: "category_no", label: "หมวดที่", type: "number" },
      { key: "category_name", label: "ชื่อหมวด", type: "text" },
      { key: "item_no", label: "ข้อ", type: "text" },
      { key: "item_name", label: "เกณฑ์การประเมิน", type: "text", required: true },
      { key: "full_score", label: "คะแนนเต็ม", type: "number" },
      { key: "pass_rule", label: "เกณฑ์ผ่าน", type: "text" },
    ],
  },

  /* ─────────── 9. งานอนามัยโรงเรียน ─────────── */
  schoolhealth: {
    key: "schoolhealth",
    table: "school",
    label: "งานอนามัยโรงเรียน",
    shortLabel: "อนามัยโรงเรียน",
    icon: "🏫",
    description: "ทะเบียนโรงเรียน ตรวจสุขภาพนักเรียน วัคซีนในโรงเรียน และกิจกรรมสุขศึกษา",
    subPages: [
      { slug: "", label: "ทะเบียนโรงเรียน", icon: "🏫" },
      { slug: "checkup", label: "ตรวจสุขภาพนักเรียน", icon: "🩺" },
      { slug: "vaccine", label: "วัคซีนในโรงเรียน", icon: "💉" },
      { slug: "activity", label: "กิจกรรมสุขศึกษา", icon: "📣" },
      { slug: "report", label: "รายงานผลการดำเนินงาน", icon: "📊" },
    ],
    defaultSort: "school_name",
    defaultSortDir: "asc",
    fields: [
      { key: "school_name", label: "ชื่อโรงเรียน", type: "text", required: true },
      { key: "village_no", label: "หมู่ที่", type: "text" },
      { key: "address", label: "ที่ตั้ง", type: "text", hideInTable: true },
      { key: "director_name", label: "ผู้อำนวยการ", type: "text" },
      { key: "health_teacher", label: "ครูอนามัย", type: "text" },
      { key: "phone", label: "เบอร์ติดต่อ", type: "text", hideInTable: true },
      { key: "student_count", label: "จำนวนนักเรียน", type: "number" },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },

  /* ─────────── 10. งาน อสม. / ประชุม ─────────── */
  vhv: {
    key: "vhv",
    table: "vhv",
    label: "งาน อสม. / ประชุม",
    shortLabel: "อสม. / ประชุม",
    icon: "🤝",
    description: "ทะเบียน อสม. เขตรับผิดชอบ ระบบประชุม การเข้าร่วมประชุม และรายงานผลงาน",
    subPages: [
      { slug: "", label: "ทะเบียน อสม.", icon: "🧑‍🤝‍🧑" },
      { slug: "area", label: "เขตรับผิดชอบ", icon: "🗺️" },
      { slug: "meeting", label: "ระบบประชุม อสม.", icon: "📅" },
      { slug: "attendance", label: "บันทึกการเข้าร่วมประชุม", icon: "✍️" },
      { slug: "performance", label: "รายงานผลงาน อสม.", icon: "📊" },
    ],
    defaultSort: "vhv_code",
    defaultSortDir: "asc",
    fields: [
      { key: "vhv_code", label: "เลขทะเบียน อสม.", type: "text" },
      { key: "prefix", label: "คำนำหน้า", type: "select", options: ["นาย", "นาง", "นางสาว"] },
      { key: "first_name", label: "ชื่อ", type: "text", required: true },
      { key: "last_name", label: "นามสกุล", type: "text", required: true },
      { key: "citizen_id", label: "เลขประจำตัวประชาชน", type: "text", hideInTable: true },
      { key: "birth_date", label: "วันเกิด", type: "date", hideInTable: true },
      { key: "gender", label: "เพศ", type: "select", options: ["ชาย", "หญิง"], hideInTable: true },
      { key: "education", label: "การศึกษา", type: "select", options: ["ประถมศึกษา", "มัธยมศึกษาตอนต้น", "มัธยมศึกษาตอนปลาย/ปวช.", "อนุปริญญา/ปวส.", "ปริญญาตรีขึ้นไป"], hideInTable: true },
      { key: "occupation", label: "อาชีพ", type: "text", hideInTable: true },
      { key: "village_no", label: "หมู่ที่", type: "text" },
      { key: "village_name", label: "หมู่บ้านรับผิดชอบ", type: "text" },
      { key: "household_count", label: "จำนวนหลังคาเรือน", type: "number" },
      { key: "start_date", label: "วันที่เป็น อสม.", type: "date", hideInTable: true },
      { key: "expertise", label: "ความชำนาญพิเศษ", type: "text", hideInTable: true },
      { key: "bank_account", label: "เลขบัญชีธนาคาร", type: "text", hideInTable: true, help: "ใช้สำหรับโอนค่าป่วยการ" },
      { key: "phone", label: "เบอร์โทร", type: "text" },
      { key: "status", label: "สถานะ", type: "select", options: ["ปฏิบัติงาน", "พ้นสภาพ"], badge: true },
      { key: "note", label: "หมายเหตุ", type: "textarea", hideInTable: true },
    ],
  },
};

export const MODULE_KEYS = Object.keys(MODULES);

export function getModule(key: string): ModuleDef | null {
  return Object.prototype.hasOwnProperty.call(MODULES, key) ? MODULES[key] : null;
}

export const STATUS_TONE: Record<string, "good" | "warn" | "bad"> = {
  ปกติ: "good",
  ดี: "good",
  พร้อมใช้งาน: "good",
  ปฏิบัติงาน: "good",
  เสร็จสิ้น: "good",
  หาย: "good",
  อนุมัติแล้ว: "good",
  ลา: "warn",
  ซ่อมบำรุง: "warn",
  รอซ่อม: "warn",
  กำลังดำเนินการ: "warn",
  กำลังรักษา: "warn",
  ต้องติดตาม: "warn",
  รออนุมัติ: "warn",
  เสื่อมสภาพ: "warn",
  "ย้าย/ลาออก": "bad",
  ไม่พร้อมใช้งาน: "bad",
  ชำรุด: "bad",
  จำหน่ายแล้ว: "bad",
  ส่งต่อ: "bad",
  ตาย: "bad",
  พ้นสภาพ: "bad",
  ยังไม่เริ่ม: "bad",
  ยกเลิก: "bad",
  ไม่อนุมัติ: "bad",
  เกษียณ: "bad",
};
