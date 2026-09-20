import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { getOrg, nfmt, orDots, thaiDate } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface Doc {
  id: number;
  report_date: Date;
  period: string | null;
  target_count: number | null;
  actual_count: number | null;
  achievement_pct: string | null;
  budget_used: string | null;
  activity_summary: string | null;
  problem: string | null;
  suggestion: string | null;
  reporter: string | null;
  note: string | null;
  project_name: string;
  project_code: string | null;
  fiscal_year: number;
  responsible: string | null;
  objective: string | null;
  target_group: string | null;
  budget: string | null;
  fund_source: string | null;
}

/** รายงานผลการดำเนินงานโครงการ */
export default async function PrintProjectReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "strategy")) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const doc = await queryOne<Doc>(
    `SELECT r.*, p.project_name, p.project_code, p.fiscal_year, p.responsible,
            p.objective, p.target_group, p.budget, p.fund_source
     FROM project_report r JOIN project p ON p.id = r.project_id
     WHERE r.id = $1`,
    [id],
  );
  if (!doc) notFound();

  const org = await getOrg();
  const budget = Number(doc.budget ?? 0);
  const used = Number(doc.budget_used ?? 0);
  const remain = budget - used;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <GovDocHeader
          org={org}
          title="รายงานผลการดำเนินงานโครงการ"
          subtitle={`ปีงบประมาณ ${doc.fiscal_year}`}
          docNo={doc.project_code}
        />

        <table className="mb-5">
          <tbody>
            <tr>
              <th style={{ width: "28%" }} className="text-left">
                ชื่อโครงการ
              </th>
              <td colSpan={3}>{doc.project_name}</td>
            </tr>
            <tr>
              <th className="text-left">ผู้รับผิดชอบโครงการ</th>
              <td>{orDots(doc.responsible, 20)}</td>
              <th style={{ width: "18%" }} className="text-left">
                รอบรายงาน
              </th>
              <td>{doc.period ?? "-"}</td>
            </tr>
            <tr>
              <th className="text-left">วัตถุประสงค์</th>
              <td colSpan={3} className="whitespace-pre-wrap">
                {doc.objective ?? "-"}
              </td>
            </tr>
            <tr>
              <th className="text-left">กลุ่มเป้าหมาย</th>
              <td colSpan={3}>{doc.target_group ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <div className="font-bold mb-2">ผลการดำเนินงานเทียบเป้าหมาย</div>
        <table className="mb-5">
          <thead>
            <tr>
              <th>เป้าหมาย</th>
              <th>ผลงานจริง</th>
              <th>ร้อยละความสำเร็จ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center">{doc.target_count ?? "-"}</td>
              <td className="text-center">{doc.actual_count ?? "-"}</td>
              <td className="text-center">
                {doc.achievement_pct ? `${nfmt(doc.achievement_pct)}%` : "-"}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="font-bold mb-2">การใช้จ่ายงบประมาณ</div>
        <table className="mb-5">
          <thead>
            <tr>
              <th>งบที่ได้รับ (บาท)</th>
              <th>ใช้ไป (บาท)</th>
              <th>คงเหลือ (บาท)</th>
              <th>แหล่งงบ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-right">{nfmt(budget)}</td>
              <td className="text-right">{nfmt(used)}</td>
              <td className="text-right">{nfmt(remain)}</td>
              <td className="text-center">{doc.fund_source ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <div className="font-bold mb-1">สรุปกิจกรรมที่ดำเนินการ</div>
        <div className="mb-4 whitespace-pre-wrap leading-loose">
          {doc.activity_summary ?? "-"}
        </div>

        <div className="font-bold mb-1">ปัญหา / อุปสรรค</div>
        <div className="mb-4 whitespace-pre-wrap leading-loose">{doc.problem ?? "-"}</div>

        <div className="font-bold mb-1">ข้อเสนอแนะ</div>
        <div className="mb-8 whitespace-pre-wrap leading-loose">{doc.suggestion ?? "-"}</div>

        <div className="grid grid-cols-2 gap-8 mt-10 text-center leading-loose">
          <div>
            <div>(ลงชื่อ) ................................................ ผู้รายงาน</div>
            <div>( {orDots(doc.reporter ?? doc.responsible, 25)} )</div>
            <div>วันที่ {thaiDate(doc.report_date)}</div>
          </div>
          <div>
            <div>(ลงชื่อ) ................................................ ผู้อนุมัติ</div>
            <div>( {orDots(org.director_name, 25)} )</div>
            <div>{org.director_title ?? "ผู้อำนวยการ"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
