import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { fiscalYearOf, getPcuAssessment, savePcuScore } from "@/lib/pcu";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/pcu/score?year=2569 — เกณฑ์ทุกข้อพร้อมคะแนนและสรุปรายหมวด
 * POST /api/pcu/score            — บันทึกคะแนนรายข้อ
 */

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canAccessModule(user.role, "pcu")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงงานมาตรฐาน PCU" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year")) || fiscalYearOf();
    const summary = await getPcuAssessment(year);
    return NextResponse.json({ ...summary, canWrite: canWriteModule(user.role, "pcu") });
  } catch (err) {
    console.error("pcu score read failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลการประเมินไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canWriteModule(user.role, "pcu")) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์บันทึกคะแนนการประเมิน" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const year = Number(body.fiscal_year);
    const criteriaId = Number(body.criteria_id);

    if (!Number.isInteger(year) || year < 2500 || year > 2700) {
      return NextResponse.json({ error: "ปีงบประมาณไม่ถูกต้อง" }, { status: 400 });
    }
    if (!Number.isInteger(criteriaId) || criteriaId <= 0) {
      return NextResponse.json({ error: "รหัสเกณฑ์ไม่ถูกต้อง" }, { status: 400 });
    }

    const rawScore = body.score;
    const score =
      rawScore === null || rawScore === undefined || rawScore === "" ? null : Number(rawScore);

    await savePcuScore(
      year,
      criteriaId,
      {
        score,
        evidence: typeof body.evidence === "string" ? body.evidence : null,
        assessor: typeof body.assessor === "string" && body.assessor ? body.assessor : user.fullName,
        assessDate: typeof body.assess_date === "string" ? body.assess_date : null,
        note: typeof body.note === "string" ? body.note : null,
      },
      user.username,
    );

    await writeAudit({
      user,
      moduleKey: "pcu",
      action: "บันทึกคะแนนมาตรฐาน PCU",
      detail: `ปีงบประมาณ ${year} เกณฑ์ #${criteriaId} คะแนน ${score ?? "-"}`,
      recordId: criteriaId,
    });

    const summary = await getPcuAssessment(year);
    return NextResponse.json({ ok: true, ...summary, canWrite: true });
  } catch (err) {
    console.error("pcu score save failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "บันทึกคะแนนไม่สำเร็จ" },
      { status: 400 },
    );
  }
}
