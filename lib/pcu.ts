import { query } from "./db";
import { PCU_CATEGORIES } from "./seed";

/**
 * การประเมินมาตรฐาน PCU ตามคู่มือคุณภาพมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566
 *
 * เกณฑ์ผ่านต่างกันตามหมวด
 *   หมวด 1-4 (งานพื้นฐาน)  ต้องได้คะแนนเต็มทุกข้อ
 *   หมวด 5-8 (งานบริการ)   ต้องได้รวมไม่น้อยกว่า 80% ของคะแนนเต็มในหมวด
 */

export interface PcuItemRow {
  id: number;
  category_no: number;
  category_name: string;
  item_no: string;
  item_name: string;
  full_score: number;
  pass_rule: string | null;
  score: number | null;
  evidence: string | null;
  assessor: string | null;
  assess_date: string | null;
  note: string | null;
}

export interface PcuCategorySummary {
  no: number;
  name: string;
  passPct: number;
  fullScore: number;
  earned: number;
  percent: number;
  itemCount: number;
  scoredCount: number;
  failedItems: string[];
  passed: boolean;
}

export interface PcuSummary {
  fiscalYear: number;
  items: PcuItemRow[];
  categories: PcuCategorySummary[];
  fullScore: number;
  earned: number;
  percent: number;
  scoredCount: number;
  itemCount: number;
  passed: boolean;
}

/** ปีงบประมาณไทยของวันที่หนึ่ง ๆ (เริ่ม 1 ต.ค.) */
export function fiscalYearOf(date = new Date()): number {
  const year = date.getFullYear() + 543;
  return date.getMonth() >= 9 ? year + 1 : year;
}

function passPctOf(categoryNo: number): number {
  return PCU_CATEGORIES.find((c) => c.no === categoryNo)?.passPct ?? (categoryNo <= 4 ? 100 : 80);
}

/** ดึงเกณฑ์ทุกข้อพร้อมคะแนนที่ประเมินไว้ในปีงบประมาณที่เลือก */
export async function getPcuAssessment(fiscalYear: number): Promise<PcuSummary> {
  const rows = await query<{
    id: number;
    category_no: number;
    category_name: string;
    item_no: string;
    item_name: string;
    full_score: string;
    pass_rule: string | null;
    score: string | null;
    evidence: string | null;
    assessor: string | null;
    assess_date: Date | null;
    note: string | null;
  }>(
    `SELECT c.id, c.category_no, c.category_name, c.item_no, c.item_name,
            c.full_score, c.pass_rule,
            a.score, a.evidence, a.assessor, a.assess_date, a.note
     FROM pcu_criteria c
     LEFT JOIN pcu_assessment a ON a.criteria_id = c.id AND a.fiscal_year = $1
     ORDER BY c.sort_order, c.id`,
    [fiscalYear],
  );

  const items: PcuItemRow[] = rows.map((r) => ({
    id: r.id,
    category_no: r.category_no,
    category_name: r.category_name,
    item_no: r.item_no,
    item_name: r.item_name,
    full_score: Number(r.full_score),
    pass_rule: r.pass_rule,
    score: r.score === null ? null : Number(r.score),
    evidence: r.evidence,
    assessor: r.assessor,
    assess_date: r.assess_date ? new Date(r.assess_date).toISOString().slice(0, 10) : null,
    note: r.note,
  }));

  const categoryNos = [...new Set(items.map((i) => i.category_no))].sort((a, b) => a - b);

  const categories: PcuCategorySummary[] = categoryNos.map((no) => {
    const group = items.filter((i) => i.category_no === no);
    const fullScore = group.reduce((sum, i) => sum + i.full_score, 0);
    const earned = group.reduce((sum, i) => sum + (i.score ?? 0), 0);
    const passPct = passPctOf(no);
    const percent = fullScore > 0 ? Math.round((earned / fullScore) * 1000) / 10 : 0;

    // หมวดที่ต้องผ่านทุกข้อ: ข้อไหนยังไม่เต็มถือว่าไม่ผ่าน
    const failedItems =
      passPct === 100
        ? group.filter((i) => (i.score ?? 0) < i.full_score).map((i) => i.item_no)
        : [];

    return {
      no,
      name: group[0]?.category_name ?? `หมวด ${no}`,
      passPct,
      fullScore,
      earned,
      percent,
      itemCount: group.length,
      scoredCount: group.filter((i) => i.score !== null).length,
      failedItems,
      passed: passPct === 100 ? failedItems.length === 0 : percent >= passPct,
    };
  });

  const fullScore = categories.reduce((sum, c) => sum + c.fullScore, 0);
  const earned = categories.reduce((sum, c) => sum + c.earned, 0);

  return {
    fiscalYear,
    items,
    categories,
    fullScore,
    earned,
    percent: fullScore > 0 ? Math.round((earned / fullScore) * 1000) / 10 : 0,
    scoredCount: items.filter((i) => i.score !== null).length,
    itemCount: items.length,
    passed: categories.length > 0 && categories.every((c) => c.passed),
  };
}

/** บันทึก/แก้ไขคะแนนรายข้อ (หนึ่งข้อมีได้หนึ่งคะแนนต่อปีงบประมาณ) */
export async function savePcuScore(
  fiscalYear: number,
  criteriaId: number,
  input: {
    score: number | null;
    evidence?: string | null;
    assessor?: string | null;
    assessDate?: string | null;
    note?: string | null;
  },
  byUser: string,
): Promise<void> {
  const criteria = await query<{ full_score: string }>(
    `SELECT full_score FROM pcu_criteria WHERE id = $1`,
    [criteriaId],
  );
  if (criteria.length === 0) throw new Error("ไม่พบเกณฑ์ข้อที่ระบุ");

  const fullScore = Number(criteria[0].full_score);
  if (input.score !== null) {
    if (!Number.isFinite(input.score) || input.score < 0) {
      throw new Error("คะแนนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
    }
    if (input.score > fullScore) {
      throw new Error(`คะแนนเกินคะแนนเต็มของข้อนี้ (เต็ม ${fullScore})`);
    }
  }

  await query(
    `INSERT INTO pcu_assessment
       (fiscal_year, criteria_id, score, evidence, assessor, assess_date, note, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     ON CONFLICT (fiscal_year, criteria_id) DO UPDATE SET
       score = EXCLUDED.score,
       evidence = EXCLUDED.evidence,
       assessor = EXCLUDED.assessor,
       assess_date = EXCLUDED.assess_date,
       note = EXCLUDED.note,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [
      fiscalYear,
      criteriaId,
      input.score,
      input.evidence ?? null,
      input.assessor ?? null,
      input.assessDate || null,
      input.note ?? null,
      byUser,
    ],
  );
}
