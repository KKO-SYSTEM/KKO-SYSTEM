import { query } from "./db";

/**
 * ข้อมูลตั้งต้นของระบบ
 * - PCU: เกณฑ์มาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566 (8 หมวด 253 คะแนน)
 * - คลัง: คลังยาใหญ่/ย่อย และคลังวัคซีน
 * - วันหยุดราชการ
 */

/** เกณฑ์ PCU 8 หมวด — หมวด 1-4 ต้องผ่านทุกข้อ, หมวด 5-8 ผ่านที่ 80% */
export const PCU_CATEGORIES = [
  { no: 1, name: "ระบบบริหารจัดการ", total: 6, passPct: 100 },
  { no: 2, name: "บุคลากรและศักยภาพบริการ", total: 8, passPct: 100 },
  { no: 3, name: "อาคารสถานที่และสิ่งแวดล้อม", total: 5, passPct: 100 },
  { no: 4, name: "ระบบข้อมูลสารสนเทศ", total: 9, passPct: 100 },
  { no: 5, name: "บริการสุขภาพปฐมภูมิ", total: 60, passPct: 80 },
  { no: 6, name: "ระบบชันสูตร", total: 40, passPct: 80 },
  { no: 7, name: "ระบบยาและคุ้มครองผู้บริโภค", total: 65, passPct: 80 },
  { no: 8, name: "การป้องกันและควบคุมการติดเชื้อ", total: 60, passPct: 80 },
];

const PCU_ITEMS: { cat: number; no: string; name: string; score: number }[] = [
  // หมวด 1 ระบบบริหารจัดการ (6 คะแนน)
  { cat: 1, no: "1.1", name: "มีคณะกรรมการพัฒนาคุณภาพและมาตรฐาน 7-10 คน", score: 1 },
  { cat: 1, no: "1.2", name: "มีแผนยุทธศาสตร์สอดคล้องกับระบบสุขภาพ พ.ศ. 2564-2575", score: 1 },
  { cat: 1, no: "1.3", name: "มีการจัดสรรทรัพยากรและงบประมาณตามแผน", score: 1 },
  { cat: 1, no: "1.4", name: "มีระบบรับและจัดการข้อร้องเรียน", score: 1 },
  { cat: 1, no: "1.5", name: "มีการประชุมคณะกรรมการและบันทึกรายงานการประชุม", score: 1 },
  { cat: 1, no: "1.6", name: "มีการติดตามประเมินผลการดำเนินงานตามแผน", score: 1 },

  // หมวด 2 บุคลากรและศักยภาพบริการ (8 คะแนน)
  { cat: 2, no: "2.1", name: "มีผู้ประกอบวิชาชีพตามเกณฑ์ที่กำหนด", score: 1 },
  { cat: 2, no: "2.2", name: "อัตรากำลังเพียงพอต่อประชากรในความรับผิดชอบ", score: 1 },
  { cat: 2, no: "2.3", name: "มีการมอบหมายหน้าที่ความรับผิดชอบเป็นลายลักษณ์อักษร", score: 1 },
  { cat: 2, no: "2.4", name: "บุคลากรได้รับการพัฒนาศักยภาพอย่างต่อเนื่อง", score: 1 },
  { cat: 2, no: "2.5", name: "มีแผนพัฒนาบุคลากรรายบุคคล", score: 1 },
  { cat: 2, no: "2.6", name: "มีหลักฐานการอบรมและใบรับรองของบุคลากร", score: 1 },
  { cat: 2, no: "2.7", name: "มีระบบให้คำปรึกษาจากแพทย์เวชศาสตร์ครอบครัว", score: 1 },
  { cat: 2, no: "2.8", name: "มีการประเมินความพึงพอใจของผู้รับบริการ", score: 1 },

  // หมวด 3 อาคารสถานที่และสิ่งแวดล้อม (5 คะแนน)
  { cat: 3, no: "3.1", name: "อาคารสถานที่มั่นคง ปลอดภัย และมีป้ายสัญลักษณ์ชัดเจน", score: 1 },
  { cat: 3, no: "3.2", name: "มีการจัดพื้นที่บริการเหมาะสมและเป็นสัดส่วน", score: 1 },
  { cat: 3, no: "3.3", name: "มีสิ่งอำนวยความสะดวกสำหรับผู้พิการและผู้สูงอายุ", score: 1 },
  { cat: 3, no: "3.4", name: "มีระบบจัดการขยะและสิ่งแวดล้อมตามมาตรฐาน", score: 1 },
  { cat: 3, no: "3.5", name: "มีระบบความปลอดภัยและการป้องกันอัคคีภัย", score: 1 },

  // หมวด 4 ระบบข้อมูลสารสนเทศ (9 คะแนน)
  { cat: 4, no: "4.1", name: "มีระบบข้อมูลผู้รับบริการที่เป็นปัจจุบัน", score: 1 },
  { cat: 4, no: "4.2", name: "มีการบันทึกข้อมูลตามมาตรฐาน 43 แฟ้ม", score: 1 },
  { cat: 4, no: "4.3", name: "ส่งข้อมูลเข้าระบบ HDC ครบถ้วนตามกำหนด", score: 1 },
  { cat: 4, no: "4.4", name: "มีการตรวจสอบคุณภาพข้อมูลอย่างสม่ำเสมอ", score: 1 },
  { cat: 4, no: "4.5", name: "มีระบบสำรองข้อมูลและกู้คืนข้อมูล", score: 1 },
  { cat: 4, no: "4.6", name: "มีมาตรการคุ้มครองข้อมูลส่วนบุคคลตาม PDPA", score: 1 },
  { cat: 4, no: "4.7", name: "มีการกำหนดสิทธิ์การเข้าถึงข้อมูลตามบทบาท", score: 1 },
  { cat: 4, no: "4.8", name: "มีการนำข้อมูลไปใช้วางแผนและตัดสินใจ", score: 1 },
  { cat: 4, no: "4.9", name: "มีระบบเชื่อมโยงข้อมูลกับหน่วยบริการแม่ข่าย", score: 1 },

  // หมวด 5 บริการสุขภาพปฐมภูมิ (60 คะแนน)
  { cat: 5, no: "5.1", name: "OTOP — การตอบสนองปัญหาสุขภาพเฉพาะพื้นที่", score: 5 },
  { cat: 5, no: "5.2", name: "OPD — บริการผู้ป่วยนอกทั่วไป", score: 5 },
  { cat: 5, no: "5.3", name: "ER — บริการอุบัติเหตุและฉุกเฉิน", score: 5 },
  { cat: 5, no: "5.4", name: "ANC — บริการฝากครรภ์", score: 5 },
  { cat: 5, no: "5.5", name: "WCC — คลินิกสุขภาพเด็กดี", score: 5 },
  { cat: 5, no: "5.6", name: "NCD — เบาหวาน ความดัน หลอดเลือดสมอง ไตเรื้อรัง", score: 5 },
  { cat: 5, no: "5.7", name: "บริการทันตกรรม", score: 5 },
  { cat: 5, no: "5.8", name: "บริการแพทย์แผนไทย", score: 5 },
  { cat: 5, no: "5.9", name: "บริการกายภาพบำบัด", score: 5 },
  { cat: 5, no: "5.10", name: "การดูแลระยะยาว (LTC) กลุ่มเป้าหมาย 4 กลุ่ม", score: 5 },
  { cat: 5, no: "5.11", name: "การเยี่ยมบ้านและดูแลต่อเนื่องในชุมชน", score: 5 },
  { cat: 5, no: "5.12", name: "งานควบคุมโรคในพื้นที่", score: 5 },

  // หมวด 6 ระบบชันสูตร (40 คะแนน)
  { cat: 6, no: "6.1", name: "มีรายการตรวจทางห้องปฏิบัติการตามเกณฑ์", score: 6 },
  { cat: 6, no: "6.2", name: "เครื่องมือได้รับการสอบเทียบตามกำหนด", score: 6 },
  { cat: 6, no: "6.3", name: "มีระบบควบคุมคุณภาพภายใน (IQC)", score: 6 },
  { cat: 6, no: "6.4", name: "มีระบบควบคุมคุณภาพภายนอก (EQA)", score: 6 },
  { cat: 6, no: "6.5", name: "มีระบบส่งต่อสิ่งส่งตรวจที่ได้มาตรฐาน", score: 6 },
  { cat: 6, no: "6.6", name: "มีการรายงานผลตรวจที่ถูกต้องและทันเวลา", score: 5 },
  { cat: 6, no: "6.7", name: "มีมาตรการความปลอดภัยทางห้องปฏิบัติการ", score: 5 },

  // หมวด 7 ระบบยาและคุ้มครองผู้บริโภค (65 คะแนน)
  { cat: 7, no: "7.1", name: "มีบัญชีรายการยาที่เหมาะสมกับหน่วยบริการ", score: 8 },
  { cat: 7, no: "7.2", name: "มีระบบจัดเก็บยาตามมาตรฐานและควบคุมอุณหภูมิ", score: 8 },
  { cat: 7, no: "7.3", name: "มีทะเบียนรับ-จ่ายยาและ Stock Card เป็นปัจจุบัน", score: 8 },
  { cat: 7, no: "7.4", name: "มีระบบตรวจสอบยาหมดอายุและยาเสื่อมสภาพ", score: 8 },
  { cat: 7, no: "7.5", name: "มีระบบความปลอดภัยด้านยา (Medication Safety)", score: 8 },
  { cat: 7, no: "7.6", name: "มีเภสัชกรให้คำปรึกษาและตรวจสอบคุณภาพ", score: 8 },
  { cat: 7, no: "7.7", name: "มีการจัดการวัคซีนตามระบบลูกโซ่ความเย็น", score: 9 },
  { cat: 7, no: "7.8", name: "งานคุ้มครองผู้บริโภคด้านสาธารณสุขในพื้นที่", score: 8 },

  // หมวด 8 การป้องกันและควบคุมการติดเชื้อ (60 คะแนน)
  { cat: 8, no: "8.1", name: "มีระบบและผู้รับผิดชอบงาน IC ชัดเจน", score: 15 },
  { cat: 8, no: "8.2", name: "มีการทำความสะอาดและทำลายเชื้อเครื่องมือตามมาตรฐาน", score: 15 },
  { cat: 8, no: "8.3", name: "มีการจัดการขยะติดเชื้อตามมาตรฐาน", score: 15 },
  { cat: 8, no: "8.4", name: "บุคลากรปฏิบัติตามหลัก Standard Precautions", score: 15 },
];

/** ใส่เกณฑ์ PCU — ข้ามถ้ามีอยู่แล้ว */
export async function seedPcuCriteria(): Promise<number> {
  const existing = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM pcu_criteria`,
  );
  if (Number(existing[0]?.count ?? 0) > 0) return 0;

  let order = 0;
  for (const item of PCU_ITEMS) {
    const cat = PCU_CATEGORIES.find((c) => c.no === item.cat)!;
    await query(
      `INSERT INTO pcu_criteria (category_no, category_name, item_no, item_name, full_score, pass_rule, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        item.cat,
        cat.name,
        item.no,
        item.name,
        item.score,
        cat.passPct === 100 ? "ต้องผ่านทุกข้อ" : `ผ่านที่ ${cat.passPct}%`,
        order++,
      ],
    );
  }
  return PCU_ITEMS.length;
}

/** คลังเริ่มต้น */
export async function seedWarehouses(): Promise<number> {
  const existing = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM warehouse`,
  );
  if (Number(existing[0]?.count ?? 0) > 0) return 0;

  const rows = [
    { kind: "drug", name: "คลังยาใหญ่ (คลังใน)", is_main: true },
    { kind: "drug", name: "คลังยาย่อย (ห้องจ่ายยา)", is_main: false },
    { kind: "vaccine", name: "คลังวัคซีนหลัก", is_main: true },
    { kind: "vaccine", name: "คลังวัคซีนย่อย", is_main: false },
  ];
  for (const r of rows) {
    await query(`INSERT INTO warehouse (kind, name, is_main) VALUES ($1, $2, $3)`, [
      r.kind,
      r.name,
      r.is_main,
    ]);
  }
  return rows.length;
}

/* ═══════════ ข้อมูลตัวอย่างสำหรับทดลองใช้ ═══════════ */

export async function seedSampleData(by: string): Promise<number> {
  let n = 0;

  const count = async (table: string) => {
    const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    return Number(r[0]?.count ?? 0);
  };

  /* บุคลากร */
  if ((await count("personnel")) === 0) {
    const people = [
      ["นางสาว", "สุนิสา", "แก้วมณี", "ผู้อำนวยการ รพ.สต.", "ข้าราชการ", "งานบริหาร", "2015-06-01", "081-234-5601"],
      ["นาย", "วิชัย", "ศรีสุข", "นักวิชาการสาธารณสุขชำนาญการ", "ข้าราชการ", "งานส่งเสริมสุขภาพ", "2018-10-15", "081-234-5602"],
      ["นาง", "พรทิพย์", "บุญมี", "พยาบาลวิชาชีพชำนาญการ", "ข้าราชการ", "งานเวชปฏิบัติครอบครัว", "2017-03-20", "081-234-5603"],
      ["นาย", "อนุชา", "ใจดี", "เจ้าพนักงานเภสัชกรรมชำนาญงาน", "ข้าราชการ", "งานเภสัชกรรม", "2019-05-05", "081-234-5604"],
      ["นางสาว", "กัญญา", "รุ่งเรือง", "เจ้าพนักงานธุรการ", "พนักงานราชการ", "งานธุรการ/การเงิน", "2020-01-10", "081-234-5605"],
      ["นาย", "สมบัติ", "ทองแท้", "พนักงานขับรถยนต์", "ลูกจ้างประจำ", "งานบริหาร", "2016-08-22", "081-234-5606"],
    ];
    for (const p of people) {
      await query(
        `INSERT INTO personnel (prefix, first_name, last_name, position, person_type, department, start_date, phone, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ปฏิบัติงาน',$9,$9)`,
        [...p, by],
      );
      n++;
    }
  }

  /* ยานพาหนะ */
  if ((await count("vehicle")) === 0) {
    const vehicles = [
      ["1", "รถพยาบาล (Ambulance)", "Toyota Hiace 2019", "2800", "กข-1234", "รถพยาบาล", 1250000, "2019-03-15", 85200],
      ["2", "รถยนต์ส่วนกลาง", "Toyota Vigo 2018", "2500", "บฉ-5678", "รถยนต์ส่วนกลาง", 720000, "2018-07-01", 42150],
      ["3", "รถจักรยานยนต์", "Honda Wave 2021", "110", "1กก-9012", "จักรยานยนต์", 42000, "2021-05-20", 15300],
    ];
    for (const v of vehicles) {
      await query(
        `INSERT INTO vehicle (seq_no, vehicle_name, model, engine_size, plate, vehicle_type, price, acquired_date, current_mileage, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'พร้อมใช้งาน',$10,$10)`,
        [...v, by],
      );
      n++;
    }
  }

  /* รายการยา + วัคซีน */
  if ((await count("inventory_item")) === 0) {
    const drugs = [
      ["drug", "D001", "Paracetamol", "พาราเซตามอล 500 มก.", "500 mg", "เม็ด", "เม็ด", "ยาในบัญชียาหลัก", 0.5, 500, 3000],
      ["drug", "D002", "Amoxicillin", "อะม็อกซีซิลลิน 500 มก.", "500 mg", "แคปซูล", "แคปซูล", "ยาในบัญชียาหลัก", 2.5, 300, 2000],
      ["drug", "D003", "ORS", "ผงเกลือแร่ ORS", "-", "ผง", "ซอง", "ยาในบัญชียาหลัก", 5, 100, 600],
      ["drug", "D004", "Antacid", "ยาลดกรด", "-", "ยาน้ำ", "ขวด", "ยาในบัญชียาหลัก", 25, 50, 300],
      ["drug", "D005", "Chlorpheniramine", "คลอเฟนิรามีน 4 มก.", "4 mg", "เม็ด", "เม็ด", "ยาในบัญชียาหลัก", 0.25, 400, 2500],
    ];
    const vaccines = [
      ["vaccine", "V001", "DTP", "วัคซีนคอตีบ-บาดทะยัก-ไอกรน", "-", "ฉีด", "โดส", "วัคซีน EPI", 0, 50, 400],
      ["vaccine", "V002", "MMR", "วัคซีนหัด-คางทูม-หัดเยอรมัน", "-", "ฉีด", "โดส", "วัคซีน EPI", 0, 30, 300],
      ["vaccine", "V003", "OPV", "วัคซีนโปลิโอชนิดหยอด", "-", "หยอด", "โดส", "วัคซีน EPI", 0, 50, 400],
      ["vaccine", "V004", "Influenza", "วัคซีนไข้หวัดใหญ่", "-", "ฉีด", "โดส", "วัคซีนตามฤดูกาล", 0, 40, 300],
      ["vaccine", "V005", "HepB", "วัคซีนตับอักเสบบี", "-", "ฉีด", "โดส", "วัคซีน EPI", 0, 40, 300],
    ];
    for (const it of [...drugs, ...vaccines]) {
      await query(
        `INSERT INTO inventory_item (kind, code, generic_name, trade_name, strength, dosage_form, unit, category, unit_price, min_qty, max_qty, storage_temp, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [...it, it[0] === "vaccine" ? "2-8°C" : "อุณหภูมิห้อง", by],
      );
      n++;
    }

    /* ล็อตและรายการรับเข้าเริ่มต้น */
    const items = await query<{ id: number; kind: string; code: string }>(
      `SELECT id, kind, code FROM inventory_item ORDER BY id`,
    );
    const lotData: Record<string, { lot: string; exp: string; qty: number }> = {
      D001: { lot: "P2401", exp: "2027-03-01", qty: 1200 },
      D002: { lot: "P2355", exp: "2026-11-15", qty: 180 },
      D003: { lot: "P2360", exp: "2026-09-30", qty: 90 },
      D004: { lot: "P2372", exp: "2027-01-20", qty: 60 },
      D005: { lot: "P2388", exp: "2026-10-25", qty: 800 },
      V001: { lot: "LT2401", exp: "2027-02-01", qty: 150 },
      V002: { lot: "LT2355", exp: "2026-09-15", qty: 40 },
      V003: { lot: "LT2402", exp: "2027-05-10", qty: 200 },
      V004: { lot: "LT2410", exp: "2026-10-30", qty: 75 },
      V005: { lot: "LT2388", exp: "2027-01-05", qty: 110 },
    };
    const warehouses = await query<{ id: number; kind: string; is_main: boolean }>(
      `SELECT id, kind, is_main FROM warehouse`,
    );

    for (const item of items) {
      const d = lotData[item.code];
      if (!d) continue;
      const wh = warehouses.find((w) => w.kind === item.kind && w.is_main);
      const lot = await query<{ id: number }>(
        `INSERT INTO inventory_lot (item_id, warehouse_id, lot_no, expiry_date, qty)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [item.id, wh?.id ?? null, d.lot, d.exp, d.qty],
      );
      await query(
        `INSERT INTO stock_movement (kind, move_date, doc_no, move_type, item_id, lot_id, lot_no, expiry_date, warehouse_id, qty_in, balance_after, source_dest, created_by)
         VALUES ($1, CURRENT_DATE - 30, 'INV-เริ่มต้น', 'รับเข้า', $2, $3, $4, $5, $6, $7, $7, 'ยกยอดเริ่มต้น', $8)`,
        [item.kind, item.id, lot[0].id, d.lot, d.exp, wh?.id ?? null, d.qty, by],
      );
      n++;
    }
  }

  /* ครุภัณฑ์ */
  if ((await count("asset")) === 0) {
    const assets = [
      ["7440-001-0001", "ครุภัณฑ์การแพทย์", "เครื่องวัดความดันโลหิตแบบดิจิทัล", "Omron HEM-7156", "2022-04-10", 12000, 5, "ห้องตรวจ 1", "นางพรทิพย์ บุญมี", "ดี"],
      ["7440-002-0002", "คอมพิวเตอร์/IT", "เครื่องคอมพิวเตอร์ตั้งโต๊ะ", "Dell OptiPlex 3080", "2021-06-01", 22000, 5, "งานธุรการ", "นางสาวกัญญา รุ่งเรือง", "ดี"],
      ["7440-003-0003", "ครุภัณฑ์การแพทย์", "ตู้เย็นเก็บวัคซีน", "Haier HBC-120", "2020-11-20", 45000, 8, "ห้องคลังวัคซีน", "นายอนุชา ใจดี", "ดี"],
      ["7440-004-0004", "คอมพิวเตอร์/IT", "เครื่องพิมพ์เลเซอร์", "HP LaserJet M404", "2019-09-15", 8500, 5, "งานธุรการ", "นางสาวกัญญา รุ่งเรือง", "รอซ่อม"],
      ["7440-005-0005", "ครุภัณฑ์การแพทย์", "เตียงตรวจผู้ป่วย", "รุ่นมาตรฐาน", "2018-02-05", 15000, 10, "ห้องตรวจ 2", "นางพรทิพย์ บุญมี", "ชำรุด"],
    ];
    for (const a of assets) {
      const price = a[5] as number;
      const life = a[6] as number;
      const rate = 100 / life;
      const annual = price / life;
      await query(
        `INSERT INTO asset (asset_code, asset_type, name, brand_model, acquired_date, unit_price, unit_count, total_value,
           useful_life_years, depreciation_rate, annual_depreciation, location, responsible_person, condition_status, fund_source, acquire_method, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,1,$6,$7,$8,$9,$10,$11,$12,'เงินงบประมาณ','จัดซื้อ',$13,$13)`,
        [a[0], a[1], a[2], a[3], a[4], price, life, rate, annual, a[7], a[8], a[9], by],
      );
      n++;
    }
  }

  /* ผู้ป่วยโรคติดต่อ (รง.506) */
  if ((await count("disease_case")) === 0) {
    const cases = [
      ["เด็กชายภูมิ ใจกล้า", "ชาย", 12, "ไข้เลือดออก", "26", "2026-08-10", "หมู่ 3 บ้านสุขใจ", "ผู้ป่วยนอก", "หาย"],
      ["เด็กหญิงพิมพ์ ดวงดี", "หญิง", 9, "ไข้เลือดออก", "26", "2026-08-14", "หมู่ 5 บ้านโนนสูง", "ผู้ป่วยนอก", "กำลังรักษา"],
      ["เด็กชายกันต์ สายทอง", "ชาย", 4, "มือ เท้า ปาก", "71", "2026-08-16", "หมู่ 2 บ้านท่าช้าง", "ผู้ป่วยนอก", "กำลังรักษา"],
      ["นางสมใจ รักดี", "หญิง", 35, "อุจจาระร่วง", "02", "2026-07-28", "หมู่ 1 บ้านกลาง", "ผู้ป่วยนอก", "หาย"],
      ["นายบุญมา ศรีทอง", "ชาย", 67, "ไข้หวัดใหญ่", "15", "2026-08-05", "หมู่ 4 บ้านหนองบัว", "ผู้ป่วยใน", "ส่งต่อ"],
    ];
    for (const c of cases) {
      await query(
        `INSERT INTO disease_case (patient_name, gender, age_year, disease_name, disease_code, onset_date, treat_date, village_name, patient_type, treat_result, report_date, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$6,$10,$10)`,
        [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], by],
      );
      n++;
    }

    /* ข้อมูลย้อนหลัง 12 เดือน เพื่อให้กราฟแนวโน้มมีข้อมูลให้ดู
       จำนวนผู้ป่วยต่อเดือนอิงรูปแบบตามฤดูกาลจริงของไทย
       (ไข้เลือดออกสูงช่วงฤดูฝน มิ.ย.-ก.ย. / ไข้หวัดใหญ่สูงช่วงปลายปีและต้นฝน) */
    const seasonal: { monthsAgo: number; disease: string; code: string; count: number }[] = [
      { monthsAgo: 11, disease: "ไข้หวัดใหญ่", code: "15", count: 3 },
      { monthsAgo: 10, disease: "ไข้หวัดใหญ่", code: "15", count: 4 },
      { monthsAgo: 10, disease: "อุจจาระร่วง", code: "02", count: 2 },
      { monthsAgo: 9, disease: "ไข้หวัดใหญ่", code: "15", count: 2 },
      { monthsAgo: 8, disease: "อุจจาระร่วง", code: "02", count: 3 },
      { monthsAgo: 7, disease: "มือ เท้า ปาก", code: "71", count: 2 },
      { monthsAgo: 6, disease: "ไข้เลือดออก", code: "26", count: 2 },
      { monthsAgo: 5, disease: "ไข้เลือดออก", code: "26", count: 4 },
      { monthsAgo: 5, disease: "มือ เท้า ปาก", code: "71", count: 3 },
      { monthsAgo: 4, disease: "ไข้เลือดออก", code: "26", count: 6 },
      { monthsAgo: 3, disease: "ไข้เลือดออก", code: "26", count: 8 },
      { monthsAgo: 3, disease: "อุจจาระร่วง", code: "02", count: 2 },
      { monthsAgo: 2, disease: "ไข้เลือดออก", code: "26", count: 7 },
      { monthsAgo: 2, disease: "มือ เท้า ปาก", code: "71", count: 2 },
      { monthsAgo: 1, disease: "ไข้เลือดออก", code: "26", count: 5 },
    ];

    const villages = [
      "หมู่ 1 บ้านกลาง",
      "หมู่ 2 บ้านท่าช้าง",
      "หมู่ 3 บ้านสุขใจ",
      "หมู่ 4 บ้านหนองบัว",
      "หมู่ 5 บ้านโนนสูง",
    ];

    let seq = 0;
    for (const s of seasonal) {
      for (let i = 0; i < s.count; i++) {
        seq++;
        const day = 3 + ((seq * 7) % 24); // กระจายวันภายในเดือน
        const age = 3 + ((seq * 13) % 70);
        await query(
          `INSERT INTO disease_case
             (patient_name, gender, age_year, disease_name, disease_code,
              onset_date, treat_date, village_name, patient_type, treat_result,
              report_date, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,
                   (date_trunc('month', CURRENT_DATE) - ($6 || ' months')::interval + ($7 || ' days')::interval)::date,
                   (date_trunc('month', CURRENT_DATE) - ($6 || ' months')::interval + ($7 || ' days')::interval)::date,
                   $8, $9, 'หาย',
                   (date_trunc('month', CURRENT_DATE) - ($6 || ' months')::interval + ($7 || ' days')::interval)::date,
                   $10, $10)`,
          [
            `ผู้ป่วยรายที่ ${seq} (ข้อมูลตัวอย่าง)`,
            seq % 2 === 0 ? "ชาย" : "หญิง",
            age,
            s.disease,
            s.code,
            String(s.monthsAgo),
            String(day),
            villages[seq % villages.length],
            seq % 9 === 0 ? "ผู้ป่วยใน" : "ผู้ป่วยนอก",
            by,
          ],
        );
        n++;
      }
    }
  }

  /* โครงการ + งบประมาณ */
  if ((await count("project")) === 0) {
    const projects = [
      ["P69-001", "โครงการควบคุมโรคไข้เลือดออก", 2569, "นายวิชัย ศรีสุข", 80000, "งบ กปท.", "กำลังดำเนินการ", 52000],
      ["P69-002", "โครงการส่งเสริมสุขภาพผู้สูงอายุ", 2569, "นางพรทิพย์ บุญมี", 120000, "งบ สปสช.", "เสร็จสิ้น", 120000],
      ["P69-003", "โครงการอนามัยแม่และเด็ก", 2569, "นางพรทิพย์ บุญมี", 60000, "งบ กปท.", "กำลังดำเนินการ", 15000],
      ["P69-004", "โครงการปรับปรุงอาคาร รพ.สต.", 2569, "นางสาวสุนิสา แก้วมณี", 300000, "เงินบำรุง", "ยังไม่เริ่ม", 0],
    ];
    for (const p of projects) {
      const rows = await query<{ id: number }>(
        `INSERT INTO project (project_code, project_name, fiscal_year, responsible, budget, fund_source, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
        [p[0], p[1], p[2], p[3], p[4], p[5], p[6], by],
      );
      const spent = p[7] as number;
      if (spent > 0) {
        await query(
          `INSERT INTO budget_transaction (project_id, txn_date, doc_no, detail, amount, requester, created_by)
           VALUES ($1, CURRENT_DATE - 20, 'ฎ.001', 'เบิกจ่ายตามแผนงาน', $2, $3, $4)`,
          [rows[0].id, spent, p[3], by],
        );
      }
      n++;
    }
  }

  /* โรงเรียน */
  if ((await count("school")) === 0) {
    const schools = [
      ["โรงเรียนบ้านสุขใจ", "3", "นายสมชาย ครูดี", "นางสาวมาลี ใจงาม", 210],
      ["โรงเรียนวัดโนนสูง", "5", "นางวันดี สอนเก่ง", "นายประสิทธิ์ รักเรียน", 85],
      ["โรงเรียนบ้านท่าช้าง", "2", "นายมานพ เพียรดี", "นางสุดา อ่อนหวาน", 140],
    ];
    for (const s of schools) {
      await query(
        `INSERT INTO school (school_name, village_no, director_name, health_teacher, student_count, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [...s, by],
      );
      n++;
    }
  }

  /* อสม. */
  if ((await count("vhv")) === 0) {
    const vhvs = [
      ["อสม.001", "นาง", "สมศรี", "ใจงาม", "1", "บ้านกลาง", 25, "2018-05-01", "089-111-2201"],
      ["อสม.002", "นาย", "ประยูร", "แสงทอง", "2", "บ้านท่าช้าง", 30, "2017-03-15", "089-111-2202"],
      ["อสม.003", "นาง", "บุญเรือน", "ศรีวิลัย", "3", "บ้านสุขใจ", 28, "2019-01-10", "089-111-2203"],
      ["อสม.004", "นาย", "สมพงษ์", "ดวงแก้ว", "4", "บ้านหนองบัว", 22, "2020-06-01", "089-111-2204"],
      ["อสม.005", "นางสาว", "รัตนา", "พูลสวัสดิ์", "5", "บ้านโนนสูง", 26, "2016-09-20", "089-111-2205"],
    ];
    for (const v of vhvs) {
      await query(
        `INSERT INTO vhv (vhv_code, prefix, first_name, last_name, village_no, village_name, household_count, start_date, phone, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ปฏิบัติงาน',$10,$10)`,
        [...v, by],
      );
      n++;
    }
  }

  /* สถิติผู้รับบริการรายเดือน */
  if ((await count("service_stat")) === 0) {
    const months = [
      [1, 380], [2, 400], [3, 430], [4, 360], [5, 445], [6, 470], [7, 500], [8, 620],
    ];
    for (const [m, v] of months) {
      await query(
        `INSERT INTO service_stat (stat_month, stat_year, service_type, count_value, created_by, updated_by)
         VALUES ($1, 2569, 'ผู้ป่วยนอก', $2, $3, $3) ON CONFLICT DO NOTHING`,
        [m, v, by],
      );
      await query(
        `INSERT INTO service_stat (stat_month, stat_year, service_type, count_value, created_by, updated_by)
         VALUES ($1, 2569, 'เยี่ยมบ้าน', $2, $3, $3) ON CONFLICT DO NOTHING`,
        [m, Math.round(v * 0.45), by],
      );
      await query(
        `INSERT INTO service_stat (stat_month, stat_year, service_type, count_value, created_by, updated_by)
         VALUES ($1, 2569, 'บริการสุขภาพอื่นๆ', $2, $3, $3) ON CONFLICT DO NOTHING`,
        [m, Math.round(v * 0.55), by],
      );
      n += 3;
    }
  }

  /* ข่าวประชาสัมพันธ์ */
  if ((await count("announcement")) === 0) {
    const news = [
      ["ประชุม อสม. ประจำเดือน", "ประชุม อสม. ประจำเดือน ณ ห้องประชุม รพ.สต.", "2026-08-15"],
      ["โครงการตรวจสุขภาพผู้สูงอายุ", "ออกหน่วยตรวจสุขภาพผู้สูงอายุในพื้นที่ หมู่ 1-5", "2026-08-20"],
      ["อบรมพัฒนาศักยภาพเจ้าหน้าที่", "อบรมการใช้ระบบสารสนเทศและการคุ้มครองข้อมูลส่วนบุคคล", "2026-08-25"],
    ];
    for (const a of news) {
      await query(
        `INSERT INTO announcement (title, body, publish_date, created_by) VALUES ($1,$2,$3,$4)`,
        [...a, by],
      );
      n++;
    }
  }

  /* ── พื้นที่ระบาด ── */
  if ((await count("outbreak_area")) === 0) {
    const areas = [
      ["บ้านหนองบัว หมู่ 3", "3", "ไข้เลือดออก", "2026-06-12", "2026-08-28", 9, 640, "สูง", "กำลังระบาด"],
      ["บ้านโนนสูง หมู่ 5", "5", "ไข้เลือดออก", "2026-05-02", "2026-06-30", 4, 520, "ปานกลาง", "ควบคุมได้"],
      ["บ้านคลองใหม่ หมู่ 1", "1", "อุจจาระร่วง", "2026-07-08", "2026-07-20", 6, 410, "ปานกลาง", "ยุติการระบาด"],
    ];
    for (const a of areas) {
      const cases = Number(a[5]);
      const pop = Number(a[6]);
      await query(
        `INSERT INTO outbreak_area
          (area_name, village_no, disease_name, first_case_date, last_case_date, case_count,
           population, attack_rate, risk_level, status, measure, responsible, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
        [
          a[0],
          a[1],
          a[2],
          a[3],
          a[4],
          cases,
          pop,
          Math.round((cases / pop) * 1000 * 100) / 100,
          a[7],
          a[8],
          "สำรวจและกำจัดลูกน้ำยุงลาย พ่นหมอกควันรัศมี 100 เมตร และให้สุขศึกษาในชุมชน",
          "นายวิชัย ศรีสุข",
          by,
        ],
      );
      n++;
    }
  }

  /* ── เขตรับผิดชอบ อสม. ── */
  if ((await count("vhv_area")) === 0) {
    const vhvs = await query<{ id: number; village_no: string | null; village_name: string | null }>(
      `SELECT id, village_no, village_name FROM vhv ORDER BY id LIMIT 6`,
    );
    for (const v of vhvs) {
      await query(
        `INSERT INTO vhv_area
          (vhv_id, village_no, village_name, household_count, population_count,
           elderly_count, chronic_count, disabled_count, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [
          v.id,
          v.village_no,
          v.village_name,
          12 + (v.id % 5) * 3,
          48 + (v.id % 5) * 11,
          6 + (v.id % 4),
          4 + (v.id % 3),
          1 + (v.id % 2),
          by,
        ],
      );
      n++;
    }
  }

  /* ── ประชุม อสม. + บันทึกการเข้าร่วม ── */
  if ((await count("vhv_meeting")) === 0) {
    const meeting = await query<{ id: number }>(
      `INSERT INTO vhv_meeting
        (meeting_no, meeting_date, location, agenda, resolution, recorder_name, chairman_name, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
      [
        "8/2569",
        "2026-08-15",
        "ห้องประชุม รพ.สต.",
        "1. เรื่องที่ประธานแจ้งให้ทราบ\n2. รายงานสถานการณ์ไข้เลือดออกในพื้นที่\n3. การเตรียมรณรงค์ตรวจคัดกรองเบาหวาน-ความดัน\n4. เรื่องอื่น ๆ",
        "ที่ประชุมมีมติให้ อสม. ทุกหมู่สำรวจลูกน้ำยุงลายทุกสัปดาห์ และรายงานผลภายในวันศุกร์ของทุกสัปดาห์",
        "นางสาวกัญญา รุ่งเรือง",
        "นางสาวสุนิสา แก้วมณี",
        by,
      ],
    );
    n++;

    const meetingId = meeting[0]?.id;
    if (meetingId) {
      const vhvs = await query<{ id: number }>(`SELECT id FROM vhv ORDER BY id`);
      const statuses = ["มา", "มา", "มา", "มาสาย", "ลา", "มา", "ขาด", "มา"];
      for (let i = 0; i < vhvs.length; i++) {
        await query(
          `INSERT INTO vhv_attendance (meeting_id, vhv_id, status, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$4) ON CONFLICT DO NOTHING`,
          [meetingId, vhvs[i].id, statuses[i % statuses.length], by],
        );
        n++;
      }
    }
  }

  /* ── รายงานผลโครงการ ── */
  if ((await count("project_report")) === 0) {
    const projects = await query<{ id: number; budget: string | null }>(
      `SELECT id, budget FROM project ORDER BY id LIMIT 3`,
    );
    const periods = ["ไตรมาส 2", "ไตรมาส 3", "ไตรมาส 3"];
    for (let i = 0; i < projects.length; i++) {
      const target = 120 + i * 40;
      const actual = Math.round(target * (0.72 + i * 0.09));
      await query(
        `INSERT INTO project_report
          (project_id, report_date, period, target_count, actual_count, achievement_pct,
           budget_used, activity_summary, problem, suggestion, reporter, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          projects[i].id,
          "2026-07-31",
          periods[i],
          target,
          actual,
          Math.round((actual / target) * 1000) / 10,
          Math.round(Number(projects[i].budget ?? 0) * 0.65),
          "ดำเนินกิจกรรมตามแผน ได้แก่ ประชาสัมพันธ์ในชุมชน ออกหน่วยให้บริการ และติดตามกลุ่มเป้าหมายรายบุคคล",
          "กลุ่มเป้าหมายบางส่วนไม่สะดวกมารับบริการในวันเวลาราชการ",
          "ปรับรูปแบบเป็นการออกหน่วยเชิงรุกในชุมชนช่วงเย็นและวันหยุด",
          "นายวิชัย ศรีสุข",
          by,
        ],
      );
      n++;
    }
  }

  /* ── ตัวอย่างผลประเมิน PCU + หลักฐานประกอบ ── */
  if ((await count("pcu_assessment")) === 0) {
    const criteria = await query<{ id: number; category_no: number; full_score: string }>(
      `SELECT id, category_no, full_score FROM pcu_criteria ORDER BY sort_order LIMIT 28`,
    );
    for (const c of criteria) {
      const full = Number(c.full_score);
      // หมวดพื้นฐานให้เต็ม ส่วนหมวดบริการให้ราว 80-90% เพื่อให้เห็นผลทั้งผ่านและไม่ผ่าน
      const score = c.category_no <= 3 ? full : Math.round(full * 0.85 * 10) / 10;
      await query(
        `INSERT INTO pcu_assessment
          (fiscal_year, criteria_id, score, evidence, assessor, assess_date, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
         ON CONFLICT (fiscal_year, criteria_id) DO NOTHING`,
        [2569, c.id, score, "แฟ้มหลักฐานหมวด " + c.category_no, "คณะกรรมการพัฒนาคุณภาพ", "2026-08-01", by],
      );
      n++;
    }
  }

  if ((await count("pcu_evidence")) === 0) {
    const criteria = await query<{ id: number; item_no: string }>(
      `SELECT id, item_no FROM pcu_criteria ORDER BY sort_order LIMIT 5`,
    );
    const kinds = ["คำสั่งแต่งตั้ง", "แผน / โครงการ", "รายงานการประชุม", "ทะเบียน / บันทึก", "ภาพถ่าย"];
    for (let i = 0; i < criteria.length; i++) {
      await query(
        `INSERT INTO pcu_evidence
          (fiscal_year, criteria_id, evidence_name, evidence_type, doc_date, location, responsible, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [
          2569,
          criteria[i].id,
          `หลักฐานประกอบเกณฑ์ข้อ ${criteria[i].item_no}`,
          kinds[i % kinds.length],
          "2026-07-15",
          "แฟ้มงานคุณภาพ ห้องธุรการ",
          "นางสาวกัญญา รุ่งเรือง",
          by,
        ],
      );
      n++;
    }
  }

  return n;
}
