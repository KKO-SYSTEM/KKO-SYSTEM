import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { fiscalYearOf } from "@/lib/leave-types";
import { PCU_CATEGORIES } from "@/lib/seed";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function todayThai(): string {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

async function orgName(): Promise<string> {
  const row = await queryOne<{ org_name: string }>(
    `SELECT org_name FROM org_settings WHERE id = 1`,
  );
  return row?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล";
}

/**
 * POST /api/reports/[kind] — สร้างร่างรายงานจากแม่แบบ + ข้อมูลจริงในฐานข้อมูล
 *
 * เป็นการประกอบข้อความจากแม่แบบราชการ ไม่ได้เรียก AI ภายนอก
 * จึงไม่มีค่าใช้จ่ายและข้อมูลไม่ออกนอกระบบ
 */
export async function POST(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    const org = await orgName();
    const fy = fiscalYearOf(new Date());
    let title = "";
    let text = "";

    if (kind === "monthly") {
      const [staff] = await query<{ total: string; active: string }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(CASE WHEN status = 'ปฏิบัติงาน' THEN 1 END)::text AS active
         FROM personnel`,
      );
      const lowStock = await query<{ generic_name: string; balance: string; min_qty: string }>(
        `SELECT i.generic_name, COALESCE(SUM(l.qty),0)::text AS balance, i.min_qty::text
         FROM inventory_item i LEFT JOIN inventory_lot l ON l.item_id = i.id
         WHERE i.is_active AND i.min_qty > 0
         GROUP BY i.id HAVING COALESCE(SUM(l.qty),0) <= i.min_qty`,
      );
      const expiring = await query<{ generic_name: string; lot_no: string; expiry_date: Date }>(
        `SELECT i.generic_name, l.lot_no, l.expiry_date
         FROM inventory_lot l JOIN inventory_item i ON i.id = l.item_id
         WHERE l.qty > 0 AND l.expiry_date IS NOT NULL AND l.expiry_date <= CURRENT_DATE + 90
         ORDER BY l.expiry_date`,
      );
      const [cases] = await query<{ total: string; active: string }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(CASE WHEN treat_result = 'กำลังรักษา' THEN 1 END)::text AS active
         FROM disease_case`,
      );
      const byDisease = await query<{ disease_name: string; c: string }>(
        `SELECT disease_name, COUNT(*)::text AS c FROM disease_case
         GROUP BY disease_name ORDER BY COUNT(*) DESC LIMIT 5`,
      );
      const projects = await query<{ status: string; c: string; budget: string; spent: string }>(
        `SELECT p.status, COUNT(*)::text AS c, COALESCE(SUM(p.budget),0)::text AS budget,
                COALESCE(SUM((SELECT SUM(amount) FROM budget_transaction b WHERE b.project_id = p.id)),0)::text AS spent
         FROM project p WHERE p.fiscal_year = $1 GROUP BY p.status`,
        [fy],
      );
      const [leaves] = await query<{ c: string; d: string }>(
        `SELECT COUNT(*)::text AS c, COALESCE(SUM(total_days),0)::text AS d
         FROM leave_request WHERE fiscal_year = $1 AND status = 'approved'`,
        [fy],
      );

      const totalBudget = projects.reduce((a, b) => a + Number(b.budget), 0);
      const totalSpent = projects.reduce((a, b) => a + Number(b.spent), 0);

      title = "รายงานสรุปผลการดำเนินงานประจำเดือน";
      text =
        `${title}\n${org}\nวันที่จัดทำ ${todayThai()}\n\n` +
        `๑. งานบุคลากร\n` +
        `   บุคลากรทั้งหมด ${staff.total} คน ปฏิบัติงานปกติ ${staff.active} คน\n` +
        `   ในปีงบประมาณ ${fy} มีการลาที่ได้รับอนุมัติแล้ว ${leaves.c} ครั้ง รวม ${Number(leaves.d).toLocaleString("th-TH")} วันทำการ\n\n` +
        `๒. งานคลังยาและเวชภัณฑ์\n` +
        (lowStock.length
          ? `   รายการที่คงเหลือต่ำกว่าจุดสั่งซื้อขั้นต่ำ ${lowStock.length} รายการ ได้แก่ ` +
            lowStock.map((d) => `${d.generic_name} (คงเหลือ ${Number(d.balance)})`).join(", ") +
            `\n`
          : `   ทุกรายการมียอดคงเหลือเพียงพอ ไม่มีรายการต่ำกว่าจุดสั่งซื้อ\n`) +
        (expiring.length
          ? `   รายการที่ใกล้หมดอายุภายใน ๙๐ วัน ${expiring.length} ล็อต ได้แก่ ` +
            expiring
              .map(
                (e) =>
                  `${e.generic_name} ล็อต ${e.lot_no ?? "-"} หมดอายุ ${new Date(e.expiry_date).toLocaleDateString("th-TH")}`,
              )
              .join(", ") +
            `\n   เห็นควรเร่งใช้ก่อนหรือประสานส่งคืน รพ.แม่ข่าย\n\n`
          : `   ไม่มีรายการที่ใกล้หมดอายุภายใน ๙๐ วัน\n\n`) +
        `๓. งานระบาดวิทยา\n` +
        `   ผู้ป่วยโรคติดต่อที่รายงานสะสม ${cases.total} ราย อยู่ระหว่างการรักษาและติดตาม ${cases.active} ราย\n` +
        (byDisease.length
          ? `   โรคที่พบมากที่สุด ได้แก่ ` +
            byDisease.map((d) => `${d.disease_name} ${d.c} ราย`).join(", ") +
            `\n\n`
          : `\n`) +
        `๔. งานแผนงานและงบประมาณ ปีงบประมาณ ${fy}\n` +
        `   โครงการทั้งหมด ${projects.reduce((a, b) => a + Number(b.c), 0)} โครงการ ` +
        projects.map((p) => `${p.status} ${p.c} โครงการ`).join(" / ") +
        `\n   งบประมาณที่ได้รับรวม ${totalBudget.toLocaleString("th-TH")} บาท ` +
        `เบิกจ่ายแล้ว ${totalSpent.toLocaleString("th-TH")} บาท ` +
        `คงเหลือ ${(totalBudget - totalSpent).toLocaleString("th-TH")} บาท ` +
        `คิดเป็นร้อยละ ${totalBudget ? ((totalSpent / totalBudget) * 100).toFixed(1) : "0.0"} ของงบประมาณที่ได้รับ\n\n` +
        `จึงเรียนมาเพื่อโปรดทราบ\n\n` +
        `ลงชื่อ ................................................ ผู้จัดทำรายงาน\n` +
        `       (                                        )\n`;
    } else if (kind === "sar") {
      const scores = await query<{ category_no: number; full: string; got: string }>(
        `SELECT c.category_no,
                SUM(c.full_score)::text AS full,
                COALESCE(SUM(a.score), 0)::text AS got
         FROM pcu_criteria c
         LEFT JOIN pcu_assessment a ON a.criteria_id = c.id AND a.fiscal_year = $1
         GROUP BY c.category_no ORDER BY c.category_no`,
        [fy],
      );

      const totalFull = scores.reduce((a, b) => a + Number(b.full), 0);
      const totalGot = scores.reduce((a, b) => a + Number(b.got), 0);

      title = "รายงานการประเมินตนเอง (SAR) — มาตรฐานบริการสุขภาพปฐมภูมิ";
      text =
        `${title}\n${org}\nปีงบประมาณ ${fy}\nวันที่จัดทำ ${todayThai()}\n\n` +
        `ตามคู่มือคุณภาพมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. ๒๕๖๖ ซึ่งกำหนดเกณฑ์การประเมินไว้ ๘ หมวด ` +
        `รวม ${totalFull} คะแนน หน่วยบริการได้ดำเนินการประเมินตนเอง สรุปผลได้ดังนี้\n\n` +
        scores
          .map((s) => {
            const cat = PCU_CATEGORIES.find((c) => c.no === s.category_no);
            const full = Number(s.full);
            const got = Number(s.got);
            const pct = full ? (got / full) * 100 : 0;
            const pass = pct >= (cat?.passPct ?? 80);
            return (
              `หมวดที่ ${s.category_no} ${cat?.name ?? ""}\n` +
              `   ได้ ${got} จาก ${full} คะแนน (ร้อยละ ${pct.toFixed(1)}) ` +
              `เกณฑ์ผ่านร้อยละ ${cat?.passPct ?? 80} — ${pass ? "ผ่านเกณฑ์" : "ยังไม่ผ่านเกณฑ์"}`
            );
          })
          .join("\n\n") +
        `\n\nสรุปภาพรวม ได้ ${totalGot} จาก ${totalFull} คะแนน ` +
        `คิดเป็นร้อยละ ${totalFull ? ((totalGot / totalFull) * 100).toFixed(1) : "0.0"}\n\n` +
        `ข้อเสนอแนะเพื่อการพัฒนา\n` +
        `   หน่วยบริการจะเร่งพัฒนาในหมวดที่ยังไม่ผ่านเกณฑ์เป็นลำดับแรก ` +
        `โดยจัดทำแผนพัฒนาคุณภาพและรวบรวมหลักฐานประกอบให้ครบถ้วนก่อนรับการประเมินจากคณะกรรมการ\n\n` +
        `ลงชื่อ ................................................ ผู้รับผิดชอบงานคุณภาพ\n`;
    } else if (kind === "meeting") {
      const [m] = await query<{
        id: number;
        meeting_no: string | null;
        meeting_date: Date;
        location: string | null;
        agenda: string | null;
        resolution: string | null;
      }>(`SELECT * FROM vhv_meeting ORDER BY meeting_date DESC LIMIT 1`);

      const [vhvCount] = await query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM vhv WHERE status = 'ปฏิบัติงาน'`,
      );

      const attend = m
        ? await query<{ status: string; c: string }>(
            `SELECT status, COUNT(*)::text AS c FROM vhv_attendance WHERE meeting_id = $1 GROUP BY status`,
            [m.id],
          )
        : [];

      const present = Number(attend.find((a) => a.status === "มา")?.c ?? 0);

      title = "รายงานการประชุมอาสาสมัครสาธารณสุขประจำหมู่บ้าน (อสม.)";
      text =
        `${title}\n${org}\n` +
        (m
          ? `ครั้งที่ ${m.meeting_no ?? "-"} วันที่ ${new Date(m.meeting_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}\n` +
            `ณ ${m.location ?? "-"}\n\n`
          : `(ยังไม่มีข้อมูลการประชุมในระบบ)\n\n`) +
        `ผู้เข้าร่วมประชุม\n` +
        `   อสม. ที่ปฏิบัติงานทั้งหมด ${vhvCount.c} คน` +
        (m ? ` เข้าร่วมประชุม ${present} คน คิดเป็นร้อยละ ${vhvCount.c !== "0" ? ((present / Number(vhvCount.c)) * 100).toFixed(1) : "0.0"}` : "") +
        `\n\n` +
        `ระเบียบวาระการประชุม\n   ${m?.agenda ?? "................................................"}\n\n` +
        `มติที่ประชุม\n   ${m?.resolution ?? "................................................"}\n\n` +
        `ปิดประชุมเวลา ................ น.\n\n` +
        `ลงชื่อ ................................................ ผู้บันทึกการประชุม\n` +
        `ลงชื่อ ................................................ ผู้ตรวจรายงานการประชุม\n`;
    } else if (kind === "project") {
      const projects = await query<{
        project_name: string;
        responsible: string | null;
        budget: string;
        spent: string;
        status: string;
        result_summary: string | null;
      }>(
        `SELECT p.project_name, p.responsible, COALESCE(p.budget,0)::text AS budget,
                COALESCE((SELECT SUM(amount) FROM budget_transaction b WHERE b.project_id = p.id),0)::text AS spent,
                p.status, p.result_summary
         FROM project p WHERE p.fiscal_year = $1 ORDER BY p.project_code`,
        [fy],
      );

      title = "รายงานผลการดำเนินงานโครงการ";
      text =
        `${title}\n${org}\nปีงบประมาณ ${fy}\nวันที่จัดทำ ${todayThai()}\n\n` +
        (projects.length === 0
          ? "ยังไม่มีโครงการในปีงบประมาณนี้\n"
          : projects
              .map((p, i) => {
                const b = Number(p.budget);
                const s = Number(p.spent);
                return (
                  `${i + 1}. ${p.project_name}\n` +
                  `   ผู้รับผิดชอบ: ${p.responsible ?? "-"}\n` +
                  `   งบประมาณที่ได้รับ ${b.toLocaleString("th-TH")} บาท เบิกจ่ายแล้ว ${s.toLocaleString("th-TH")} บาท ` +
                  `คงเหลือ ${(b - s).toLocaleString("th-TH")} บาท (ร้อยละ ${b ? ((s / b) * 100).toFixed(1) : "0.0"})\n` +
                  `   สถานะ: ${p.status}\n` +
                  `   ผลการดำเนินงาน: ${p.result_summary ?? "อยู่ระหว่างรวบรวมผลการดำเนินงาน"}\n`
                );
              })
              .join("\n")) +
        `\nลงชื่อ ................................................ ผู้รายงาน\n`;
    } else {
      return NextResponse.json({ error: "ไม่พบชนิดรายงานที่ระบุ" }, { status: 404 });
    }

    await writeAudit({ user, moduleKey: "ai", action: "สร้างร่างรายงาน", detail: title });
    return NextResponse.json({ ok: true, title, text });
  } catch (err) {
    console.error("report failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างรายงานไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
