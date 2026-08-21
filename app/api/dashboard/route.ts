import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    /* ── การ์ดสรุป 4 ใบ ── */
    const [drugExpiring] = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT l.item_id)::text AS count
       FROM inventory_lot l JOIN inventory_item i ON i.id = l.item_id
       WHERE i.kind = 'drug' AND l.qty > 0
         AND l.expiry_date IS NOT NULL
         AND l.expiry_date <= CURRENT_DATE + 90`,
    );

    const [vaccineExpiring] = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT l.item_id)::text AS count
       FROM inventory_lot l JOIN inventory_item i ON i.id = l.item_id
       WHERE i.kind = 'vaccine' AND l.qty > 0
         AND l.expiry_date IS NOT NULL
         AND l.expiry_date <= CURRENT_DATE + 90`,
    );

    const [pendingReq] = await query<{ count: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM requisition WHERE status = 'pending') +
         (SELECT COUNT(*) FROM supply_requisition WHERE status = 'pending') +
         (SELECT COUNT(*) FROM leave_request WHERE status = 'pending') +
         (SELECT COUNT(*) FROM vehicle_request WHERE status = 'pending')
       )::text AS count`,
    );

    const [onLeaveToday] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leave_request
       WHERE status = 'approved' AND CURRENT_DATE BETWEEN start_date AND end_date`,
    );

    /* ── กราฟผู้รับบริการรายเดือน ── */
    const trendRows = await query<{ stat_month: number; total: string }>(
      `SELECT stat_month, SUM(count_value)::text AS total
       FROM service_stat
       WHERE stat_year = (SELECT MAX(stat_year) FROM service_stat)
       GROUP BY stat_month ORDER BY stat_month`,
    );
    const trend = trendRows.map((r) => ({
      label: THAI_MONTHS[(r.stat_month - 1) % 12],
      value: Number(r.total),
    }));

    const typeRows = await query<{ service_type: string; total: string }>(
      `SELECT service_type, SUM(count_value)::text AS total
       FROM service_stat
       WHERE stat_year = (SELECT MAX(stat_year) FROM service_stat)
       GROUP BY service_type ORDER BY service_type`,
    );
    const byType = typeRows.map((r) => ({ label: r.service_type, value: Number(r.total) }));

    /* ── งานค้างที่ต้องติดตาม ── */
    const pending: { label: string; count: number; href: string }[] = [];

    const [noResult] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM project
       WHERE status = 'เสร็จสิ้น' AND (result_summary IS NULL OR result_summary = '')`,
    );
    pending.push({
      label: "โครงการที่ยังไม่ได้รายงานผล",
      count: Number(noResult?.count ?? 0),
      href: "/m/strategy",
    });

    const [brokenAssets] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM asset WHERE condition_status IN ('ชำรุด', 'รอซ่อม')`,
    );
    pending.push({
      label: "ครุภัณฑ์ที่รอซ่อม/ชำรุด",
      count: Number(brokenAssets?.count ?? 0),
      href: "/m/equipment",
    });

    const [activeCases] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM disease_case WHERE treat_result = 'กำลังรักษา'`,
    );
    pending.push({
      label: "ผู้ป่วยโรคติดต่อที่ต้องติดตาม",
      count: Number(activeCases?.count ?? 0),
      href: "/m/epidemiology",
    });

    const [overdueLoans] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM asset_loan
       WHERE status = 'borrowed' AND due_date < CURRENT_DATE`,
    );
    pending.push({
      label: "พัสดุที่ยืมเกินกำหนดคืน",
      count: Number(overdueLoans?.count ?? 0),
      href: "/m/equipment/loan",
    });

    const [lowStock] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM (
         SELECT i.id, COALESCE(SUM(l.qty), 0) AS total, i.min_qty
         FROM inventory_item i LEFT JOIN inventory_lot l ON l.item_id = i.id
         WHERE i.is_active AND i.min_qty > 0
         GROUP BY i.id, i.min_qty
         HAVING COALESCE(SUM(l.qty), 0) <= i.min_qty
       ) t`,
    );
    pending.push({
      label: "รายการยา/วัคซีนต่ำกว่าจุดสั่งซื้อ",
      count: Number(lowStock?.count ?? 0),
      href: "/m/pharmacy/alerts",
    });

    /* ── ข่าวประชาสัมพันธ์ ── */
    const news = await query<{ id: number; title: string; publish_date: string | null }>(
      `SELECT id, title, publish_date FROM announcement
       ORDER BY is_pinned DESC, COALESCE(publish_date, created_at::date) DESC, id DESC
       LIMIT 5`,
    );

    return NextResponse.json({
      cards: {
        drugExpiring: Number(drugExpiring?.count ?? 0),
        vaccineExpiring: Number(vaccineExpiring?.count ?? 0),
        pendingRequests: Number(pendingReq?.count ?? 0),
        onLeaveToday: Number(onLeaveToday?.count ?? 0),
      },
      trend,
      byType,
      pending: pending.filter((p) => p.count > 0),
      news,
    });
  } catch (err) {
    console.error("dashboard failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลสรุปไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
