import { query } from "./db";

/**
 * สคีมาฐานข้อมูลทั้งระบบ — สร้างแบบ idempotent (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
 *
 * อ้างอิงระเบียบ:
 * - ระเบียบสำนักนายกรัฐมนตรีว่าด้วยการลาของข้าราชการ พ.ศ. 2555
 * - ระเบียบสำนักนายกรัฐมนตรีว่าด้วยรถราชการ (แบบ 1-4, 6)
 * - ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560
 * - คู่มือคุณภาพมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566 (8 หมวด 253 คะแนน)
 * - บัตรรายงานผู้ป่วย แบบ รง.506 กรมควบคุมโรค
 */

const STATEMENTS: string[] = [
  /* ═══════════════ ระบบกลาง ═══════════════ */

  `CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    position      TEXT,
    role          TEXT NOT NULL,
    personnel_id  INTEGER,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER,
    username    TEXT,
    full_name   TEXT,
    role        TEXT,
    module_key  TEXT,
    action      TEXT NOT NULL,
    detail      TEXT,
    record_id   INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC)`,

  /* ประวัติการแก้ไข — เก็บค่าเดิม/ค่าใหม่รายฟิลด์ */
  `CREATE TABLE IF NOT EXISTS record_history (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT NOT NULL,
    record_id   INTEGER NOT NULL,
    field_key   TEXT NOT NULL,
    field_label TEXT,
    old_value   TEXT,
    new_value   TEXT,
    changed_by  TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS record_history_ref_idx ON record_history (table_name, record_id)`,

  /* ไฟล์แนบ — ใช้ร่วมกันทุกโมดูล */
  `CREATE TABLE IF NOT EXISTS attachment (
    id           SERIAL PRIMARY KEY,
    module_key   TEXT NOT NULL,
    record_id    INTEGER NOT NULL,
    file_name    TEXT NOT NULL,
    mime_type    TEXT,
    size_bytes   INTEGER,
    content      BYTEA NOT NULL,
    uploaded_by  TEXT,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS attachment_ref_idx ON attachment (module_key, record_id)`,

  /* ข่าวประชาสัมพันธ์บน Dashboard */
  `CREATE TABLE IF NOT EXISTS announcement (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT,
    publish_date DATE,
    is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* วันหยุดราชการ — ใช้คำนวณวันลา */
  `CREATE TABLE IF NOT EXISTS holiday (
    id           SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name         TEXT NOT NULL
  )`,

  /* ตั้งค่าหน่วยงาน — ใช้เป็นหัวเอกสารที่พิมพ์ออก */
  `CREATE TABLE IF NOT EXISTS org_settings (
    id             INTEGER PRIMARY KEY DEFAULT 1,
    org_name       TEXT NOT NULL DEFAULT 'โรงพยาบาลส่งเสริมสุขภาพตำบล',
    parent_org     TEXT DEFAULT '',
    district       TEXT DEFAULT '',
    province       TEXT DEFAULT '',
    director_name  TEXT DEFAULT '',
    director_title TEXT DEFAULT 'ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบล',
    address        TEXT DEFAULT '',
    phone          TEXT DEFAULT '',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT org_settings_single_row CHECK (id = 1)
  )`,

  /* ═══════════════ 1. ระบบบุคลากร ═══════════════ */

  `CREATE TABLE IF NOT EXISTS personnel (
    id             SERIAL PRIMARY KEY,
    citizen_id     TEXT,
    prefix         TEXT,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    position       TEXT,
    person_type    TEXT,
    level          TEXT,
    department     TEXT,
    start_date     DATE,
    phone          TEXT,
    email          TEXT,
    status         TEXT DEFAULT 'ปฏิบัติงาน',
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS leave_request (
    id               SERIAL PRIMARY KEY,
    doc_no           TEXT,
    personnel_id     INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    leave_type       TEXT NOT NULL,
    fiscal_year      INTEGER NOT NULL,
    written_date     DATE,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    total_days       NUMERIC NOT NULL DEFAULT 0,
    reason           TEXT,
    contact_address  TEXT,
    contact_phone    TEXT,
    substitute_name  TEXT,
    last_leave_type  TEXT,
    last_leave_from  DATE,
    last_leave_to    DATE,
    last_leave_days  NUMERIC,
    status           TEXT NOT NULL DEFAULT 'pending',
    supervisor_comment TEXT,
    approver_name    TEXT,
    approved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       TEXT,
    updated_by       TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS leave_request_person_idx ON leave_request (personnel_id, fiscal_year)`,

  `CREATE TABLE IF NOT EXISTS duty_roster (
    id           SERIAL PRIMARY KEY,
    duty_date    DATE NOT NULL,
    shift        TEXT NOT NULL,
    personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    duty_type    TEXT,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT,
    updated_by   TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS duty_roster_date_idx ON duty_roster (duty_date)`,

  /* ═══════════════ 2-3. คลังยา / คลังวัคซีน ═══════════════ */
  /* ใช้ตารางร่วมกัน แยกด้วยคอลัมน์ kind = 'drug' | 'vaccine' */

  `CREATE TABLE IF NOT EXISTS warehouse (
    id         SERIAL PRIMARY KEY,
    kind       TEXT NOT NULL,
    name       TEXT NOT NULL,
    is_main    BOOLEAN NOT NULL DEFAULT FALSE,
    note       TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS inventory_item (
    id             SERIAL PRIMARY KEY,
    kind           TEXT NOT NULL,
    code           TEXT NOT NULL,
    generic_name   TEXT NOT NULL,
    trade_name     TEXT,
    strength       TEXT,
    dosage_form    TEXT,
    unit           TEXT,
    category       TEXT,
    unit_price     NUMERIC,
    min_qty        NUMERIC DEFAULT 0,
    max_qty        NUMERIC,
    storage_temp   TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_item_kind_idx ON inventory_item (kind)`,

  `CREATE TABLE IF NOT EXISTS inventory_lot (
    id           SERIAL PRIMARY KEY,
    item_id      INTEGER NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
    warehouse_id INTEGER REFERENCES warehouse(id) ON DELETE SET NULL,
    lot_no       TEXT,
    expiry_date  DATE,
    qty          NUMERIC NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS inventory_lot_item_idx ON inventory_lot (item_id, expiry_date)`,

  /* Stock Card = ตารางนี้ */
  `CREATE TABLE IF NOT EXISTS stock_movement (
    id             BIGSERIAL PRIMARY KEY,
    kind           TEXT NOT NULL,
    move_date      DATE NOT NULL,
    doc_no         TEXT,
    move_type      TEXT NOT NULL,
    item_id        INTEGER NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
    lot_id         INTEGER REFERENCES inventory_lot(id) ON DELETE SET NULL,
    lot_no         TEXT,
    expiry_date    DATE,
    warehouse_id   INTEGER REFERENCES warehouse(id) ON DELETE SET NULL,
    qty_in         NUMERIC NOT NULL DEFAULT 0,
    qty_out        NUMERIC NOT NULL DEFAULT 0,
    balance_after  NUMERIC,
    unit_price     NUMERIC,
    source_dest    TEXT,
    requisition_id INTEGER,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS stock_movement_item_idx ON stock_movement (item_id, move_date, id)`,

  `CREATE TABLE IF NOT EXISTS requisition (
    id             SERIAL PRIMARY KEY,
    kind           TEXT NOT NULL,
    doc_no         TEXT,
    req_date       DATE NOT NULL,
    requester      TEXT,
    from_warehouse INTEGER REFERENCES warehouse(id) ON DELETE SET NULL,
    to_warehouse   INTEGER REFERENCES warehouse(id) ON DELETE SET NULL,
    purpose        TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    approver_name  TEXT,
    approved_at    TIMESTAMPTZ,
    issuer_name    TEXT,
    issued_at      TIMESTAMPTZ,
    receiver_name  TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS requisition_item (
    id             SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES requisition(id) ON DELETE CASCADE,
    item_id        INTEGER NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
    qty_requested  NUMERIC NOT NULL DEFAULT 0,
    qty_issued     NUMERIC DEFAULT 0,
    lot_id         INTEGER REFERENCES inventory_lot(id) ON DELETE SET NULL,
    note           TEXT
  )`,

  /* บันทึกอุณหภูมิตู้เย็นวัคซีน (ลูกโซ่ความเย็น) */
  `CREATE TABLE IF NOT EXISTS fridge_temp_log (
    id           SERIAL PRIMARY KEY,
    log_date     DATE NOT NULL,
    period       TEXT NOT NULL,
    fridge_name  TEXT,
    temperature  NUMERIC,
    is_normal    BOOLEAN,
    action_taken TEXT,
    recorded_by  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS fridge_temp_log_date_idx ON fridge_temp_log (log_date DESC)`,

  /* ═══════════════ 4. ยานพาหนะ ═══════════════ */

  /* แบบ 1/แบบ 2 ทะเบียนรถ */
  `CREATE TABLE IF NOT EXISTS vehicle (
    id             SERIAL PRIMARY KEY,
    seq_no         TEXT,
    vehicle_name   TEXT,
    model          TEXT,
    engine_size    TEXT,
    plate          TEXT NOT NULL,
    vehicle_type   TEXT,
    department     TEXT,
    price          NUMERIC,
    acquired_date  DATE,
    disposed_date  DATE,
    current_mileage NUMERIC,
    status         TEXT DEFAULT 'พร้อมใช้งาน',
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  /* แบบ 3 ใบขออนุญาตใช้รถส่วนกลาง */
  `CREATE TABLE IF NOT EXISTS vehicle_request (
    id                SERIAL PRIMARY KEY,
    doc_no            TEXT,
    written_date      DATE,
    addressed_to      TEXT,
    requester_name    TEXT NOT NULL,
    requester_position TEXT,
    vehicle_id        INTEGER REFERENCES vehicle(id) ON DELETE SET NULL,
    destination       TEXT NOT NULL,
    purpose           TEXT,
    passenger_count   INTEGER,
    depart_at         TIMESTAMPTZ,
    return_at         TIMESTAMPTZ,
    driver_name       TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    supervisor_name   TEXT,
    approver_name     TEXT,
    approved_at       TIMESTAMPTZ,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        TEXT,
    updated_by        TEXT
  )`,

  /* แบบ 4 บันทึกการใช้รถ */
  `CREATE TABLE IF NOT EXISTS vehicle_log (
    id             SERIAL PRIMARY KEY,
    vehicle_id     INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    request_id     INTEGER REFERENCES vehicle_request(id) ON DELETE SET NULL,
    seq_no         INTEGER,
    use_date       DATE NOT NULL,
    depart_time    TEXT,
    return_time    TEXT,
    user_name      TEXT,
    destination    TEXT,
    mileage_start  NUMERIC,
    mileage_end    NUMERIC,
    distance       NUMERIC,
    driver_name    TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS vehicle_log_vehicle_idx ON vehicle_log (vehicle_id, use_date DESC)`,

  /* แบบ 6 ประวัติซ่อมบำรุง */
  `CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    id            SERIAL PRIMARY KEY,
    vehicle_id    INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    service_date  DATE NOT NULL,
    mileage       NUMERIC,
    work_detail   TEXT,
    cost          NUMERIC,
    service_place TEXT,
    inspect_date  DATE,
    inspector     TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS fuel_log (
    id            SERIAL PRIMARY KEY,
    vehicle_id    INTEGER NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
    fuel_date     DATE NOT NULL,
    mileage       NUMERIC,
    liters        NUMERIC,
    price_per_lit NUMERIC,
    total_amount  NUMERIC,
    station       TEXT,
    requester     TEXT,
    approver_name TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  /* ═══════════════ 5. ครุภัณฑ์ / พัสดุ ═══════════════ */

  /* ทะเบียนคุมทรัพย์สิน ตามระเบียบพัสดุ 2560 */
  `CREATE TABLE IF NOT EXISTS asset (
    id                SERIAL PRIMARY KEY,
    asset_code        TEXT NOT NULL,
    asset_type        TEXT,
    name              TEXT NOT NULL,
    brand_model       TEXT,
    serial_no         TEXT,
    acquired_date     DATE,
    doc_no            TEXT,
    fund_source       TEXT,
    acquire_method    TEXT,
    unit_price        NUMERIC,
    unit_count        NUMERIC DEFAULT 1,
    total_value       NUMERIC,
    useful_life_years NUMERIC,
    depreciation_rate NUMERIC,
    annual_depreciation NUMERIC,
    accum_depreciation  NUMERIC,
    net_value         NUMERIC,
    location          TEXT,
    responsible_person TEXT,
    condition_status  TEXT DEFAULT 'ดี',
    disposed_date     DATE,
    disposed_method   TEXT,
    disposed_reason   TEXT,
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        TEXT,
    updated_by        TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS supply_item (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL,
    name        TEXT NOT NULL,
    unit        TEXT,
    category    TEXT,
    unit_price  NUMERIC,
    min_qty     NUMERIC DEFAULT 0,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  TEXT,
    updated_by  TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS supply_movement (
    id            BIGSERIAL PRIMARY KEY,
    item_id       INTEGER NOT NULL REFERENCES supply_item(id) ON DELETE CASCADE,
    move_date     DATE NOT NULL,
    doc_no        TEXT,
    move_type     TEXT NOT NULL,
    qty_in        NUMERIC NOT NULL DEFAULT 0,
    qty_out       NUMERIC NOT NULL DEFAULT 0,
    balance_after NUMERIC,
    unit_price    NUMERIC,
    source_dest   TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS supply_movement_item_idx ON supply_movement (item_id, move_date, id)`,

  /* ใบเบิกวัสดุ แบบ 8707 — ลงนาม 6 ตำแหน่งตามระเบียบ */
  `CREATE TABLE IF NOT EXISTS supply_requisition (
    id             SERIAL PRIMARY KEY,
    doc_no         TEXT,
    req_date       DATE NOT NULL,
    department     TEXT,
    purpose        TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    requester_name TEXT,
    orderer_name   TEXT,
    issuer_name    TEXT,
    receiver_name  TEXT,
    recorder_name  TEXT,
    approved_at    TIMESTAMPTZ,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS supply_requisition_item (
    id             SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES supply_requisition(id) ON DELETE CASCADE,
    item_id        INTEGER NOT NULL REFERENCES supply_item(id) ON DELETE CASCADE,
    qty_requested  NUMERIC NOT NULL DEFAULT 0,
    qty_issued     NUMERIC DEFAULT 0,
    unit_price     NUMERIC,
    note           TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS asset_loan (
    id             SERIAL PRIMARY KEY,
    doc_no         TEXT,
    asset_id       INTEGER REFERENCES asset(id) ON DELETE SET NULL,
    item_detail    TEXT,
    borrower_name  TEXT NOT NULL,
    borrower_dept  TEXT,
    reason         TEXT,
    loan_date      DATE NOT NULL,
    due_date       DATE NOT NULL,
    returned_date  DATE,
    return_condition TEXT,
    status         TEXT NOT NULL DEFAULT 'borrowed',
    approver_name  TEXT,
    inspector_name TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  /* ตรวจสอบพัสดุประจำปี ตามระเบียบพัสดุ 2560 */
  `CREATE TABLE IF NOT EXISTS asset_audit (
    id             SERIAL PRIMARY KEY,
    fiscal_year    INTEGER NOT NULL,
    appointed_date DATE,
    committee      TEXT,
    start_date     DATE,
    end_date       DATE,
    status         TEXT NOT NULL DEFAULT 'in_progress',
    summary        TEXT,
    sent_to_oag_date DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS asset_audit_item (
    id         SERIAL PRIMARY KEY,
    audit_id   INTEGER NOT NULL REFERENCES asset_audit(id) ON DELETE CASCADE,
    asset_id   INTEGER REFERENCES asset(id) ON DELETE SET NULL,
    result     TEXT,
    remark     TEXT,
    proposal   TEXT
  )`,

  /* ═══════════════ 6. งานระบาดวิทยา ═══════════════ */

  /* บัตรรายงานผู้ป่วย แบบ รง.506 */
  `CREATE TABLE IF NOT EXISTS disease_case (
    id             SERIAL PRIMARY KEY,
    report_no      TEXT,
    patient_name   TEXT NOT NULL,
    citizen_id     TEXT,
    gender         TEXT,
    age_year       INTEGER,
    age_month      INTEGER,
    nationality    TEXT DEFAULT 'ไทย',
    occupation     TEXT,
    house_no       TEXT,
    village_no     TEXT,
    village_name   TEXT,
    subdistrict    TEXT,
    district       TEXT,
    province       TEXT,
    disease_code   TEXT,
    disease_name   TEXT NOT NULL,
    onset_date     DATE,
    treat_date     DATE,
    admit_date     DATE,
    patient_type   TEXT,
    patient_status TEXT,
    treat_result   TEXT,
    report_unit    TEXT,
    reporter_name  TEXT,
    report_date    DATE,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS disease_case_idx ON disease_case (disease_name, onset_date DESC)`,

  `CREATE TABLE IF NOT EXISTS outbreak_investigation (
    id             SERIAL PRIMARY KEY,
    doc_no         TEXT,
    investigate_date DATE NOT NULL,
    disease_name   TEXT,
    area           TEXT,
    case_count     INTEGER,
    contact_count  INTEGER,
    cause          TEXT,
    control_measure TEXT,
    investigator   TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS disease_control_plan (
    id            SERIAL PRIMARY KEY,
    fiscal_year   INTEGER NOT NULL,
    disease_name  TEXT NOT NULL,
    activity      TEXT,
    target_group  TEXT,
    budget        NUMERIC,
    responsible   TEXT,
    result        TEXT,
    status        TEXT DEFAULT 'ยังไม่เริ่ม',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  /* ═══════════════ 7. แผนยุทธศาสตร์ / งบประมาณ ═══════════════ */

  `CREATE TABLE IF NOT EXISTS strategic_plan (
    id            SERIAL PRIMARY KEY,
    fiscal_year   INTEGER NOT NULL,
    strategy_name TEXT NOT NULL,
    goal          TEXT,
    kpi_name      TEXT,
    kpi_target    TEXT,
    kpi_result    TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS project (
    id             SERIAL PRIMARY KEY,
    project_code   TEXT,
    project_name   TEXT NOT NULL,
    fiscal_year    INTEGER NOT NULL,
    strategy_id    INTEGER REFERENCES strategic_plan(id) ON DELETE SET NULL,
    responsible    TEXT,
    rationale      TEXT,
    objective      TEXT,
    target_group   TEXT,
    target_count   INTEGER,
    method         TEXT,
    start_date     DATE,
    end_date       DATE,
    budget         NUMERIC DEFAULT 0,
    fund_source    TEXT,
    expected_result TEXT,
    result_summary TEXT,
    status         TEXT DEFAULT 'ยังไม่เริ่ม',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS budget_transaction (
    id           SERIAL PRIMARY KEY,
    project_id   INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    txn_date     DATE NOT NULL,
    doc_no       TEXT,
    detail       TEXT,
    amount       NUMERIC NOT NULL DEFAULT 0,
    requester    TEXT,
    approver_name TEXT,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS budget_txn_project_idx ON budget_transaction (project_id, txn_date)`,

  /* ═══════════════ 8. มาตรฐานหน่วยบริการ PCU ═══════════════ */

  `CREATE TABLE IF NOT EXISTS pcu_criteria (
    id             SERIAL PRIMARY KEY,
    category_no    INTEGER NOT NULL,
    category_name  TEXT NOT NULL,
    item_no        TEXT NOT NULL,
    item_name      TEXT NOT NULL,
    full_score     NUMERIC NOT NULL DEFAULT 1,
    pass_rule      TEXT,
    sort_order     INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS pcu_assessment (
    id            SERIAL PRIMARY KEY,
    fiscal_year   INTEGER NOT NULL,
    round_name    TEXT,
    criteria_id   INTEGER NOT NULL REFERENCES pcu_criteria(id) ON DELETE CASCADE,
    score         NUMERIC,
    evidence      TEXT,
    assessor      TEXT,
    assess_date   DATE,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pcu_assessment_uniq ON pcu_assessment (fiscal_year, criteria_id)`,

  /* ═══════════════ 9. งานอนามัยโรงเรียน ═══════════════ */

  `CREATE TABLE IF NOT EXISTS school (
    id            SERIAL PRIMARY KEY,
    school_name   TEXT NOT NULL,
    address       TEXT,
    village_no    TEXT,
    director_name TEXT,
    health_teacher TEXT,
    phone         TEXT,
    student_count INTEGER,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS student_health_check (
    id             SERIAL PRIMARY KEY,
    school_id      INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    academic_year  TEXT,
    term           TEXT,
    class_level    TEXT,
    class_room     TEXT,
    student_name   TEXT NOT NULL,
    gender         TEXT,
    birth_date     DATE,
    check_date     DATE,
    weight_kg      NUMERIC,
    height_cm      NUMERIC,
    nutrition_status TEXT,
    vision_result  TEXT,
    hearing_result TEXT,
    oral_result    TEXT,
    lice_result    TEXT,
    skin_result    TEXT,
    nail_result    TEXT,
    hygiene_result TEXT,
    referral       TEXT,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS student_health_school_idx ON student_health_check (school_id, academic_year)`,

  `CREATE TABLE IF NOT EXISTS school_vaccination (
    id            SERIAL PRIMARY KEY,
    school_id     INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    academic_year TEXT,
    class_level   TEXT,
    vaccine_name  TEXT NOT NULL,
    vaccine_date  DATE,
    target_count  INTEGER,
    received_count INTEGER,
    coverage_pct  NUMERIC,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS health_education_activity (
    id             SERIAL PRIMARY KEY,
    school_id      INTEGER REFERENCES school(id) ON DELETE SET NULL,
    activity_name  TEXT NOT NULL,
    activity_date  DATE,
    target_group   TEXT,
    participant_count INTEGER,
    organizer      TEXT,
    result         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  /* ═══════════════ 10. งาน อสม. / ประชุม ═══════════════ */

  `CREATE TABLE IF NOT EXISTS vhv (
    id             SERIAL PRIMARY KEY,
    vhv_code       TEXT,
    prefix         TEXT,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    citizen_id     TEXT,
    birth_date     DATE,
    gender         TEXT,
    education      TEXT,
    occupation     TEXT,
    address        TEXT,
    village_no     TEXT,
    village_name   TEXT,
    household_count INTEGER,
    start_date     DATE,
    expertise      TEXT,
    bank_account   TEXT,
    phone          TEXT,
    status         TEXT DEFAULT 'ปฏิบัติงาน',
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS vhv_meeting (
    id            SERIAL PRIMARY KEY,
    meeting_no    TEXT,
    meeting_date  DATE NOT NULL,
    location      TEXT,
    agenda        TEXT,
    resolution    TEXT,
    recorder_name TEXT,
    chairman_name TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS vhv_attendance (
    id         SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES vhv_meeting(id) ON DELETE CASCADE,
    vhv_id     INTEGER NOT NULL REFERENCES vhv(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'มา',
    note       TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vhv_attendance_uniq ON vhv_attendance (meeting_id, vhv_id)`,

  `CREATE TABLE IF NOT EXISTS vhv_performance (
    id             SERIAL PRIMARY KEY,
    vhv_id         INTEGER NOT NULL REFERENCES vhv(id) ON DELETE CASCADE,
    report_month   INTEGER NOT NULL,
    report_year    INTEGER NOT NULL,
    visit_count    INTEGER,
    activity       TEXT,
    highlight      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT,
    updated_by     TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vhv_performance_uniq ON vhv_performance (vhv_id, report_year, report_month)`,

  /* ═══════════════ สถิติผู้รับบริการ (สำหรับ Dashboard) ═══════════════ */

  `CREATE TABLE IF NOT EXISTS service_stat (
    id           SERIAL PRIMARY KEY,
    stat_month   INTEGER NOT NULL,
    stat_year    INTEGER NOT NULL,
    service_type TEXT NOT NULL,
    count_value  INTEGER NOT NULL DEFAULT 0,
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   TEXT,
    updated_by   TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS service_stat_uniq ON service_stat (stat_year, stat_month, service_type)`,
];

export async function migrate(): Promise<number> {
  for (const sql of STATEMENTS) {
    await query(sql);
  }
  await query(
    `INSERT INTO org_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );
  return STATEMENTS.length;
}
