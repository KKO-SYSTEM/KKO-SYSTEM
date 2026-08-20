/* =========================================================================
   RPHC Smart Management System — Prototype
   data.js : module schema (fields/columns) + sample seed data
   หมายเหตุ: นี่คือข้อมูลตัวอย่าง (mock data) สำหรับสาธิตต้นแบบเท่านั้น
   ========================================================================= */

const ROLES = [
  { key: "admin",    label: "ผู้ดูแลระบบ (Administrator)" },
  { key: "exec",      label: "ผู้บริหาร รพ.สต." },
  { key: "office",    label: "เจ้าหน้าที่สำนักงาน" },
  { key: "supply",    label: "เจ้าหน้าที่พัสดุ" },
  { key: "health",    label: "เจ้าหน้าที่สาธารณสุข" },
  { key: "finance",   label: "เจ้าหน้าที่การเงิน" },
  { key: "vhv",       label: "อสม." },
  { key: "external",  label: "ผู้เกี่ยวข้องภายนอก (ดูอย่างเดียว)" },
];

// ทุกโมดูลที่ role เห็นได้ (นอกจาก dashboard/ai/audit ที่ทุกคนเห็น ยกเว้น audit เห็นเฉพาะ admin)
const ROLE_ACCESS = {
  admin:    ["personnel","pharmacy","vaccine","vehicle","equipment","epidemiology","strategy","pcu","schoolhealth","meeting"],
  exec:     ["personnel","pharmacy","vaccine","vehicle","equipment","epidemiology","strategy","pcu","schoolhealth","meeting"],
  office:   ["personnel","meeting"],
  supply:   ["pharmacy","vaccine","equipment","vehicle"],
  health:   ["epidemiology","schoolhealth","pcu"],
  finance:  ["strategy"],
  vhv:      ["meeting"],
  external: [],
};
const READONLY_ROLES = ["exec","external","vhv"]; // ดูได้แต่แก้ไข/ลบไม่ได้ในต้นแบบนี้

const MODULES = {
  personnel: {
    label: "ระบบบุคลากร", icon: "🧑‍⚕️", group: 1,
    fields: [
      { key:"name", label:"ชื่อ-สกุล", type:"text", required:true },
      { key:"position", label:"ตำแหน่ง", type:"text" },
      { key:"department", label:"แผนก/งาน", type:"select", options:["งานบริการปฐมภูมิ","งานเวชปฏิบัติครอบครัว","งานส่งเสริมสุขภาพ","งานธุรการ/การเงิน","งานเภสัชกรรม"] },
      { key:"startDate", label:"วันเริ่มงาน", type:"date" },
      { key:"phone", label:"เบอร์โทร", type:"text" },
      { key:"status", label:"สถานะ", type:"select", options:["ปฏิบัติงาน","ลา","ย้าย/ลาออก"], badge:true },
    ],
  },
  pharmacy: {
    label: "ระบบคลังยา", icon: "💊", group: 1,
    fields: [
      { key:"code", label:"รหัสยา", type:"text", required:true },
      { key:"name", label:"ชื่อยา", type:"text", required:true },
      { key:"unit", label:"หน่วยนับ", type:"select", options:["เม็ด","ขวด","หลอด","ซอง","แผง"] },
      { key:"qty", label:"คงเหลือ", type:"number" },
      { key:"reorderPoint", label:"จุดสั่งซื้อขั้นต่ำ", type:"number" },
      { key:"expiry", label:"วันหมดอายุ", type:"date" },
    ],
  },
  vaccine: {
    label: "ระบบคลังวัคซีน", icon: "💉", group: 1,
    fields: [
      { key:"code", label:"รหัสวัคซีน", type:"text", required:true },
      { key:"name", label:"ชื่อวัคซีน", type:"text", required:true },
      { key:"lot", label:"เลขล็อต", type:"text" },
      { key:"qty", label:"คงเหลือ (โดส)", type:"number" },
      { key:"expiry", label:"วันหมดอายุ", type:"date" },
      { key:"storage", label:"อุณหภูมิจัดเก็บ", type:"select", options:["2-8°C","-15 ถึง -25°C"] },
    ],
  },
  vehicle: {
    label: "ระบบยานพาหนะ", icon: "🚑", group: 1,
    fields: [
      { key:"plate", label:"ทะเบียนรถ", type:"text", required:true },
      { key:"type", label:"ประเภท", type:"select", options:["รถพยาบาล","รถยนต์ส่วนกลาง","จักรยานยนต์"] },
      { key:"mileage", label:"เลขไมล์ล่าสุด (กม.)", type:"number" },
      { key:"lastUser", label:"ผู้ใช้งานล่าสุด", type:"text" },
      { key:"lastUseDate", label:"วันที่ใช้ล่าสุด", type:"date" },
      { key:"status", label:"สถานะ", type:"select", options:["พร้อมใช้งาน","ซ่อมบำรุง","ไม่พร้อมใช้งาน"], badge:true },
    ],
  },
  equipment: {
    label: "ระบบครุภัณฑ์/พัสดุ", icon: "🖥️", group: 1,
    fields: [
      { key:"code", label:"รหัสครุภัณฑ์", type:"text", required:true },
      { key:"name", label:"ชื่อครุภัณฑ์", type:"text", required:true },
      { key:"category", label:"หมวดหมู่", type:"select", options:["ครุภัณฑ์สำนักงาน","ครุภัณฑ์การแพทย์","คอมพิวเตอร์/IT","อื่นๆ"] },
      { key:"location", label:"ที่ตั้ง/ผู้รับผิดชอบ", type:"text" },
      { key:"condition", label:"สภาพ", type:"select", options:["ดี","ชำรุด","รอซ่อม","จำหน่ายแล้ว"], badge:true },
      { key:"receivedDate", label:"วันที่รับเข้า", type:"date" },
    ],
  },
  epidemiology: {
    label: "ระบบงานระบาดวิทยา", icon: "🦠", group: 2,
    fields: [
      { key:"foundDate", label:"วันที่พบผู้ป่วย", type:"date" },
      { key:"disease", label:"โรค", type:"select", options:["ไข้เลือดออก","ไข้หวัดใหญ่","มือ เท้า ปาก","โควิด-19","อุจจาระร่วง","อื่นๆ"] },
      { key:"village", label:"หมู่บ้าน/พื้นที่", type:"text" },
      { key:"gender", label:"เพศ", type:"select", options:["ชาย","หญิง"] },
      { key:"age", label:"อายุ (ปี)", type:"number" },
      { key:"status", label:"สถานะ", type:"select", options:["กำลังรักษา","หายแล้ว","ส่งต่อ"], badge:true },
    ],
  },
  strategy: {
    label: "ระบบแผนยุทธศาสตร์", icon: "🎯", group: 2,
    fields: [
      { key:"projectName", label:"ชื่อโครงการ/แผนงาน", type:"text", required:true },
      { key:"fiscalYear", label:"ปีงบประมาณ", type:"text" },
      { key:"budget", label:"งบประมาณที่ได้รับ (บาท)", type:"number" },
      { key:"spent", label:"เบิกจ่ายแล้ว (บาท)", type:"number" },
      { key:"status", label:"สถานะ", type:"select", options:["ยังไม่เริ่ม","กำลังดำเนินการ","เสร็จสิ้น"], badge:true },
    ],
  },
  pcu: {
    label: "มาตรฐานหน่วยบริการ PCU", icon: "✅", group: 2,
    fields: [
      { key:"category", label:"หมวดมาตรฐาน", type:"select", options:["โครงสร้าง/สถานที่","บุคลากร","ระบบบริการ","คุณภาพ/ความปลอดภัย"] },
      { key:"topic", label:"หัวข้อประเมิน", type:"text" },
      { key:"fullScore", label:"คะแนนเต็ม", type:"number" },
      { key:"score", label:"คะแนนที่ได้", type:"number" },
      { key:"evalDate", label:"วันที่ประเมิน", type:"date" },
    ],
  },
  schoolhealth: {
    label: "งานอนามัยโรงเรียน", icon: "🏫", group: 2,
    fields: [
      { key:"schoolName", label:"ชื่อโรงเรียน", type:"text", required:true },
      { key:"studentCount", label:"จำนวนนักเรียน", type:"number" },
      { key:"lastCheckup", label:"วันที่ตรวจสุขภาพล่าสุด", type:"date" },
      { key:"vaccineCoverage", label:"ความครอบคลุมวัคซีน (%)", type:"number" },
      { key:"status", label:"สถานะ", type:"select", options:["ปกติ","ต้องติดตาม"], badge:true },
    ],
  },
  meeting: {
    label: "งาน อสม. / ประชุม", icon: "🤝", group: 2,
    fields: [
      { key:"name", label:"ชื่อ อสม.", type:"text", required:true },
      { key:"village", label:"เขต/หมู่บ้านรับผิดชอบ", type:"text" },
      { key:"phone", label:"เบอร์โทร", type:"text" },
      { key:"attended", label:"เข้าประชุมแล้ว (ครั้ง)", type:"number" },
      { key:"totalMeetings", label:"จัดประชุมทั้งหมด (ครั้ง)", type:"number" },
      { key:"status", label:"สถานะ", type:"select", options:["ปฏิบัติงาน","พ้นสภาพ"], badge:true },
    ],
  },
};

const NAV_ORDER = ["dashboard","personnel","pharmacy","vaccine","vehicle","equipment","epidemiology","strategy","pcu","schoolhealth","meeting","ai","audit","settings"];

function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2,9); }

const SEED = {
  personnel: [
    { name:"นางสาวสุนิสา แก้วมณี", position:"ผู้อำนวยการ รพ.สต.", department:"งานบริหาร", startDate:"2558-06-01", phone:"081-234-5601", status:"ปฏิบัติงาน" },
    { name:"นายวิชัย ศรีสุข", position:"นักวิชาการสาธารณสุข", department:"งานส่งเสริมสุขภาพ", startDate:"2561-10-15", phone:"081-234-5602", status:"ปฏิบัติงาน" },
    { name:"นางพรทิพย์ บุญมี", position:"พยาบาลวิชาชีพ", department:"งานเวชปฏิบัติครอบครัว", startDate:"2560-03-20", phone:"081-234-5603", status:"ปฏิบัติงาน" },
    { name:"นายอนุชา ใจดี", position:"เจ้าพนักงานเภสัชกรรม", department:"งานเภสัชกรรม", startDate:"2562-05-05", phone:"081-234-5604", status:"ลา" },
    { name:"นางสาวกัญญา รุ่งเรือง", position:"เจ้าหน้าที่ธุรการ", department:"งานธุรการ/การเงิน", startDate:"2563-01-10", phone:"081-234-5605", status:"ปฏิบัติงาน" },
    { name:"นายสมบัติ ทองแท้", position:"พนักงานขับรถ", department:"งานบริหาร", startDate:"2559-08-22", phone:"081-234-5606", status:"ปฏิบัติงาน" },
  ],
  pharmacy: [
    { code:"D001", name:"พาราเซตามอล 500 มก.", unit:"เม็ด", qty:1200, reorderPoint:500, expiry:"2027-03-01" },
    { code:"D002", name:"อะม็อกซีซิลลิน 500 มก.", unit:"แคปซูล", qty:180, reorderPoint:300, expiry:"2026-11-15" },
    { code:"D003", name:"ผงเกลือแร่ ORS", unit:"ซอง", qty:90, reorderPoint:100, expiry:"2026-09-30" },
    { code:"D004", name:"ยาลดกรด (Antacid)", unit:"ขวด", qty:60, reorderPoint:50, expiry:"2027-01-20" },
    { code:"D005", name:"คลอเฟนิรามีน 4 มก.", unit:"เม็ด", qty:800, reorderPoint:400, expiry:"2026-08-25" },
    { code:"D006", name:"ยาหยอดตา", unit:"ขวด", qty:25, reorderPoint:30, expiry:"2026-12-10" },
  ],
  vaccine: [
    { code:"V001", name:"วัคซีนคอตีบ-บาดทะยัก-ไอกรน (DTP)", lot:"LT2401", qty:150, expiry:"2027-02-01", storage:"2-8°C" },
    { code:"V002", name:"วัคซีนหัด-คางทูม-หัดเยอรมัน (MMR)", lot:"LT2355", qty:40, expiry:"2026-09-15", storage:"2-8°C" },
    { code:"V003", name:"วัคซีนโปลิโอ (OPV)", lot:"LT2402", qty:200, expiry:"2027-05-10", storage:"2-8°C" },
    { code:"V004", name:"วัคซีนไข้หวัดใหญ่", lot:"LT2410", qty:75, expiry:"2026-08-30", storage:"2-8°C" },
    { code:"V005", name:"วัคซีนตับอักเสบบี", lot:"LT2388", qty:110, expiry:"2027-01-05", storage:"2-8°C" },
  ],
  vehicle: [
    { plate:"กข-1234 (จังหวัด)", type:"รถพยาบาล", mileage:85200, lastUser:"นายสมบัติ ทองแท้", lastUseDate:"2026-08-18", status:"พร้อมใช้งาน" },
    { plate:"บฉ-5678 (จังหวัด)", type:"รถยนต์ส่วนกลาง", mileage:42150, lastUser:"นางสาวกัญญา รุ่งเรือง", lastUseDate:"2026-08-15", status:"ซ่อมบำรุง" },
    { plate:"1กก-9012", type:"จักรยานยนต์", mileage:15300, lastUser:"นายวิชัย ศรีสุข", lastUseDate:"2026-08-19", status:"พร้อมใช้งาน" },
  ],
  equipment: [
    { code:"E001", name:"เครื่องวัดความดันโลหิต", category:"ครุภัณฑ์การแพทย์", location:"ห้องตรวจ 1", condition:"ดี", receivedDate:"2022-04-10" },
    { code:"E002", name:"คอมพิวเตอร์ตั้งโต๊ะ", category:"คอมพิวเตอร์/IT", location:"งานธุรการ", condition:"ดี", receivedDate:"2021-06-01" },
    { code:"E003", name:"ตู้เย็นเก็บวัคซีน", category:"ครุภัณฑ์การแพทย์", location:"ห้องคลังวัคซีน", condition:"ดี", receivedDate:"2020-11-20" },
    { code:"E004", name:"เครื่องพิมพ์เลเซอร์", category:"คอมพิวเตอร์/IT", location:"งานธุรการ", condition:"รอซ่อม", receivedDate:"2019-09-15" },
    { code:"E005", name:"เตียงตรวจผู้ป่วย", category:"ครุภัณฑ์การแพทย์", location:"ห้องตรวจ 2", condition:"ชำรุด", receivedDate:"2018-02-05" },
  ],
  epidemiology: [
    { foundDate:"2026-08-10", disease:"ไข้เลือดออก", village:"หมู่ 3 บ้านสุขใจ", gender:"ชาย", age:12, status:"หายแล้ว" },
    { foundDate:"2026-08-14", disease:"ไข้เลือดออก", village:"หมู่ 5 บ้านโนนสูง", gender:"หญิง", age:9, status:"กำลังรักษา" },
    { foundDate:"2026-08-16", disease:"มือ เท้า ปาก", village:"หมู่ 2 บ้านท่าช้าง", gender:"ชาย", age:4, status:"กำลังรักษา" },
    { foundDate:"2026-07-28", disease:"อุจจาระร่วง", village:"หมู่ 1 บ้านกลาง", gender:"หญิง", age:35, status:"หายแล้ว" },
    { foundDate:"2026-08-05", disease:"ไข้หวัดใหญ่", village:"หมู่ 4 บ้านหนองบัว", gender:"ชาย", age:67, status:"ส่งต่อ" },
  ],
  strategy: [
    { projectName:"โครงการควบคุมโรคไข้เลือดออก", fiscalYear:"2569", budget:80000, spent:52000, status:"กำลังดำเนินการ" },
    { projectName:"โครงการส่งเสริมสุขภาพผู้สูงอายุ", fiscalYear:"2569", budget:120000, spent:120000, status:"เสร็จสิ้น" },
    { projectName:"โครงการอนามัยแม่และเด็ก", fiscalYear:"2569", budget:60000, spent:15000, status:"กำลังดำเนินการ" },
    { projectName:"โครงการปรับปรุงอาคาร รพ.สต.", fiscalYear:"2569", budget:300000, spent:0, status:"ยังไม่เริ่ม" },
  ],
  pcu: [
    { category:"โครงสร้าง/สถานที่", topic:"ความพร้อมของอาคารสถานที่และป้ายสัญลักษณ์", fullScore:20, score:18, evalDate:"2026-06-01" },
    { category:"บุคลากร", topic:"อัตรากำลังเทียบเกณฑ์มาตรฐาน", fullScore:20, score:15, evalDate:"2026-06-01" },
    { category:"ระบบบริการ", topic:"ระบบนัดหมายและการส่งต่อผู้ป่วย", fullScore:30, score:27, evalDate:"2026-06-02" },
    { category:"คุณภาพ/ความปลอดภัย", topic:"ระบบป้องกันการติดเชื้อและความปลอดภัยผู้ป่วย", fullScore:30, score:22, evalDate:"2026-06-02" },
  ],
  schoolhealth: [
    { schoolName:"โรงเรียนบ้านสุขใจ", studentCount:210, lastCheckup:"2026-06-15", vaccineCoverage:96, status:"ปกติ" },
    { schoolName:"โรงเรียนวัดโนนสูง", studentCount:85, lastCheckup:"2026-06-20", vaccineCoverage:78, status:"ต้องติดตาม" },
    { schoolName:"โรงเรียนบ้านท่าช้าง", studentCount:140, lastCheckup:"2026-05-30", vaccineCoverage:91, status:"ปกติ" },
  ],
  meeting: [
    { name:"นางสมศรี ใจงาม", village:"หมู่ 1 บ้านกลาง", phone:"089-111-2201", attended:8, totalMeetings:8, status:"ปฏิบัติงาน" },
    { name:"นายประยูร แสงทอง", village:"หมู่ 2 บ้านท่าช้าง", phone:"089-111-2202", attended:7, totalMeetings:8, status:"ปฏิบัติงาน" },
    { name:"นางบุญเรือน ศรีวิลัย", village:"หมู่ 3 บ้านสุขใจ", phone:"089-111-2203", attended:6, totalMeetings:8, status:"ปฏิบัติงาน" },
    { name:"นายสมพงษ์ ดวงแก้ว", village:"หมู่ 4 บ้านหนองบัว", phone:"089-111-2204", attended:5, totalMeetings:8, status:"ปฏิบัติงาน" },
    { name:"นางสาวรัตนา พูลสวัสดิ์", village:"หมู่ 5 บ้านโนนสูง", phone:"089-111-2205", attended:8, totalMeetings:8, status:"ปฏิบัติงาน" },
  ],
};

// จำนวนผู้รับบริการรายเดือน (ตัวอย่าง) สำหรับกราฟ dashboard
const VISIT_TREND = [
  { m:"ม.ค.", v:610 },{ m:"ก.พ.", v:640 },{ m:"มี.ค.", v:700 },{ m:"เม.ย.", v:590 },
  { m:"พ.ค.", v:720 },{ m:"มิ.ย.", v:760 },{ m:"ก.ค.", v:810 },{ m:"ส.ค.", v:1245 },
];
const VISIT_TYPE = [
  { label:"ผู้ป่วยนอก", value:620, color:"#1F7A6C" },
  { label:"เยี่ยมบ้าน", value:280, color:"#2F9E8F" },
  { label:"บริการสุขภาพอื่นๆ", value:345, color:"#7FC8BC" },
];
