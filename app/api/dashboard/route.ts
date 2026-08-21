import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * GET /api/dashboard — ตัวเลขสรุปทั้งหมดดึงจากข้อมูลจริงในระบบ
 * ไม่มีค่าใดเป็นค่าสมมติ ทุกตัวเลขคำนวณจากตารางที่ผู้ใช้บันทึกเอง
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    /* ══════ การ์ดสรุป ══════ */

    const activeStaff = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM personnel WHERE status = 'ปฏิบัติงาน'`,
    );

    const pendingDocs = await queryOne<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM requisition WHERE status = 'pending') +
         (SELECT COUNT(*) FROM supply_requisition WHERE status = 'pending') +
         (SELECT COUNT(*) FROM leave_request WHERE status = 'pending') +
         (SELECT COUNT(*) FROM vehicle_request WHERE status = 'pending')
       )::text AS count`,
    );

    const expiring90 = await queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT l.item_id)::text AS count
       FROM inventory_lot l
       WHERE l.qty > 0 AND l.expiry_date IS NOT NULL
         AND l.expiry_date <= CURRENT_DATE + INTERVAL '90 days'`,
    );

    const lowStock = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (
         SELECT i.id FROM inventory_item i
         LEFT JOIN inventory_lot l ON l.item_id = i.id
         WHERE i.is_active AND i.min_qty > 0
         GROUP BY i.id, i.min_qty
         HAVING COALESCE(SUM(l.qty), 0) <= i.min_qty
       ) t`,
    );

    /* ══════ กราฟผู้รับบริการรายเดือน ══════ */

    const trendRows = await query<{ stat_month: number; total: string }>(
      `SELECT stat_month, SUM(count_value)::text AS total
       FROM service_stat
       WHERE stat_year = (SELECT MAX(stat_year) FROM service_stat)
       GROUP BY stat_month ORDER BY stat_month`,
    );
    const trend = trendRows.map((r) => ({
      label: TH_MONTH[Number(r.stat_month) - 1] ?? String(r.stat_month),
      value: Number(r.total),
    }));

    /* ══════ ผู้ป่วยโรคติดต่อ 12 เดือนล่าสุด แยกตามโรค ══════ */

    const diseaseRows = await query<{ disease_name: string; total: string }>(
      `SELECT disease_name, COUNT(*)::text AS total
       FROM disease_case
       WHERE onset_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY disease_name
       ORDER BY COUNT(*) DESC
       LIMIT 5`,
    );
    const diseases = diseaseRows.map((r) => ({
      label: r.disease_name,
      value: Number(r.total),
    }));

    const activeCases = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM disease_case WHERE treat_result = 'กำลังรักษา'`,
    );

    /* ══════ งบประมาณปีปัจจุบัน ══════ */

    const budget = await queryOne<{ budget: string; spent: string; projects: string }>(
      `SELECT
         COALESCE(SUM(p.budget), 0)::text AS budget,
         COALESCE((
           SELECT SUM(bt.amount) FROM budget_transaction bt
           JOIN project p2 ON p2.id = bt.project_id
           WHERE p2.fiscal_year = (SELECT MAX(fiscal_year) FROM project)
         ), 0)::text AS spent,
         COUNT(*)::text AS projects
       FROM project p
       WHERE p.fiscal_year = (SELECT MAX(fiscal_year) FROM project)`,
    );

    const fiscalYear = await queryOne<{ y: number }>(
      `SELECT MAX(fiscal_year) AS y FROM project`,
    );

    /* ══════ คะแนนมาตรฐาน PCU รายหมวด ══════ */

    const pcuRows = await query<{
      category_no: number;
      category_name: string;
      full_score: string;
      score: string;
    }>(
      `SELECT c.category_no, c.category_name,
              SUM(c.full_score)::text AS full_score,
              COALESCE(SUM(a.score), 0)::text AS score
       FROM pcu_criteria c
       LEFT JOIN pcu_assessment a
         ON a.criteria_id = c.id
        AND a.fiscal_year = (SELECT MAX(fiscal_year) FROM pcu_assessment)
       GROUP BY c.category_no, c.category_name
       ORDER BY c.category_no`,
    );
    const pcu = pcuRows.map((r) => {
      const full = Number(r.full_score);
      const got = Number(r.score);
      const passPct = r.category_no <= 4 ? 100 : 80;
      return {
        no: r.category_no,
        name: r.category_name,
        full,
        score: got,
        pct: full > 0 ? Math.round((got / full) * 100) : 0,
        passPct,
        passed: full > 0 && (got / full) * 100 >= passPct,
      };
    });
    const pcuAssessed = pcu.some((c) => c.score > 0);

    /* ══════ รายการใกล้หมดอายุ (แสดงเป็นรายการจริง) ══════ */

    const expiringList = await query<{
      name: string;
      code: string;
      lot_no: string | null;
      expiry_date: string;
      qty: string;
      unit: string | null;
      kind: string;
      days_left: string;
    }>(
      `SELECT COALESCE(i.trade_name, i.generic_name) AS name, i.code, l.lot_no,
              l.expiry_date, l.qty::text, i.unit, i.kind,
              (l.expiry_date - CURRENT_DATE)::text AS days_left
       FROM inventory_lot l
       JOIN inventory_item i ON i.id = l.item_id
       WHERE l.qty > 0 AND l.expiry_date IS NOT NULL
         AND l.expiry_date <= CURRENT_DATE + INTERVAL '120 days'
       ORDER BY l.expiry_date
       LIMIT 6`,
    );

    /* ══════ งานค้างที่ต้องติดตาม ══════ */

    const pending: { label: string; count: number; href: string }[] = [];

    const noResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM project
       WHERE status = 'เสร็จสิ้น' AND (result_summary IS NULL OR result_summary = '')`,
    );
    pending.push({
      label: "โครงการเสร็จแล้วแต่ยังไม่ได้บันทึกผล",
      count: Number(noResult?.count ?? 0),
      href: "/m/strategy",
    });

    const brokenAssets = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM asset WHERE condition_status IN ('ชำรุด', 'รอซ่อม')`,
    );
    pending.push({
      label: "ครุภัณฑ์ชำรุด / รอซ่อม",
      count: Number(brokenAssets?.count ?? 0),
      href: "/m/equipment",
    });

    const overdueLoans = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM asset_loan
       WHERE returned_date IS NULL AND due_date < CURRENT_DATE`,
    );
    pending.push({
      label: "พัสดุที่ยืมเกินกำหนดคืน",
      count: Number(overdueLoans?.count ?? 0),
      href: "/m/equipment/loan",
    });

    pending.push({
      label: "ผู้ป่วยโรคติดต่อที่ยังรักษาอยู่",
      count: Number(activeCases?.count ?? 0),
      href: "/m/epidemiology",
    });

    const badTemp = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM fridge_temp_log
       WHERE is_normal = FALSE AND log_date >= CURRENT_DATE - INTERVAL '30 days'`,
    );
    pending.push({
      label: "อุณหภูมิตู้เย็นวัคซีนผิดเกณฑ์ (30 วัน)",
      count: Number(badTemp?.count ?? 0),
      href: "/m/vaccine/coldchain",
    });

    const vehicleDown = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM vehicle
       WHERE status IN ('ซ่อมบำรุง', 'ไม่พร้อมใช้งาน')`,
    );
    pending.push({
      label: "รถที่ไม่พร้อมใช้งาน",
      count: Number(vehicleDown?.count ?? 0),
      href: "/m/vehicle",
    });

    /* ══════ ข่าวประชาสัมพันธ์ ══════ */

    const news = await query<{ id: number; title: string; publish_date: string | null }>(
      `SELECT id, title, publish_date FROM announcement
       ORDER BY is_pinned DESC, COALESCE(publish_date, created_at::date) DESC, id DESC
       LIMIT 5`,
    );

    /* ══════ กิจกรรมล่าสุดในระบบ ══════ */

    const activity = await query<{
      full_name: string | null;
      action: string;
      detail: string | null;
      created_at: string;
    }>(
      `SELECT full_name, action, detail, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 6`,
    );

    return NextResponse.json({
      cards: {
        activeStaff: Number(activeStaff?.count ?? 0),
        pendingDocs: Number(pendingDocs?.count ?? 0),
        expiring90: Number(expiring90?.count ?? 0),
        lowStock: Number(lowStock?.count ?? 0),
      },
      trend,
      diseases,
      budget: {
        fiscalYear: fiscalYear?.y ?? null,
        total: Number(budget?.budget ?? 0),
        spent: Number(budget?.spent ?? 0),
        projects: Number(budget?.projects ?? 0),
      },
      pcu,
      pcuAssessed,
      expiringList: expiringList.map((r) => ({
        name: r.name,
        code: r.code,
        lotNo: r.lot_no,
        expiryDate: r.expiry_date,
        qty: Number(r.qty),
        unit: r.unit,
        kind: r.kind,
        daysLeft: Number(r.days_left),
      })),
      pending: pending.filter((p) => p.count > 0),
      news,
      activity,
    });
  } catch (err) {
    console.error("dashboard failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลสรุปไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
