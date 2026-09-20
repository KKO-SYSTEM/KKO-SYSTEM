import ModulePageShell from "@/components/ModulePageShell";
import PrintInlineButton from "@/components/PrintInlineButton";
import YearPicker from "@/components/YearPicker";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });

interface SchoolRow {
  id: number;
  school_name: string;
  student_count: string | null;
  checked: string;
  normal: string;
  obese: string;
  thin: string;
  short: string;
  referred: string;
}

/**
 * รายงานผลการดำเนินงานอนามัยโรงเรียน — สรุปตามปีการศึกษา
 * รวมผลตรวจสุขภาพนักเรียน ความครอบคลุมวัคซีน และกิจกรรมสุขศึกษาไว้ในหน้าเดียว
 */
export default async function SchoolHealthReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: rawYear } = await searchParams;
  const academicYear = String(Number(rawYear) || new Date().getFullYear() + 543);

  const [schools, vaccines, activities, org] = await Promise.all([
    query<SchoolRow>(
      `SELECT s.id, s.school_name, s.student_count,
              COUNT(c.id)::text AS checked,
              COUNT(CASE WHEN c.nutrition_status = 'สมส่วน' THEN 1 END)::text AS normal,
              COUNT(CASE WHEN c.nutrition_status IN ('อ้วน', 'เริ่มอ้วน', 'ท้วม') THEN 1 END)::text AS obese,
              COUNT(CASE WHEN c.nutrition_status IN ('ผอม', 'ค่อนข้างผอม') THEN 1 END)::text AS thin,
              COUNT(CASE WHEN c.nutrition_status IN ('เตี้ย', 'ค่อนข้างเตี้ย') THEN 1 END)::text AS short,
              COUNT(CASE WHEN COALESCE(TRIM(c.referral), '') <> '' THEN 1 END)::text AS referred
       FROM school s
       LEFT JOIN student_health_check c
         ON c.school_id = s.id AND COALESCE(c.academic_year, '') = $1
       GROUP BY s.id, s.school_name, s.student_count
       ORDER BY s.school_name`,
      [academicYear],
    ),
    query<{
      vaccine_name: string;
      target: string;
      received: string;
      schools: string;
    }>(
      `SELECT vaccine_name,
              COALESCE(SUM(target_count), 0)::text AS target,
              COALESCE(SUM(received_count), 0)::text AS received,
              COUNT(DISTINCT school_id)::text AS schools
       FROM school_vaccination
       WHERE COALESCE(academic_year, '') = $1
       GROUP BY vaccine_name
       ORDER BY vaccine_name`,
      [academicYear],
    ),
    query<{
      activity_name: string;
      activity_date: Date | null;
      school_name: string | null;
      participant_count: number | null;
      target_group: string | null;
    }>(
      `SELECT a.activity_name, a.activity_date, s.school_name, a.participant_count, a.target_group
       FROM health_education_activity a
       LEFT JOIN school s ON s.id = a.school_id
       WHERE EXTRACT(YEAR FROM a.activity_date) + 543 BETWEEN $1::int - 1 AND $1::int
       ORDER BY a.activity_date DESC NULLS LAST
       LIMIT 50`,
      [academicYear],
    ),
    queryOne<{ org_name: string; district: string; province: string }>(
      `SELECT org_name, district, province FROM org_settings WHERE id = 1`,
    ),
  ]);

  const totals = schools.reduce(
    (acc, s) => ({
      students: acc.students + Number(s.student_count ?? 0),
      checked: acc.checked + Number(s.checked),
      normal: acc.normal + Number(s.normal),
      obese: acc.obese + Number(s.obese),
      thin: acc.thin + Number(s.thin),
      short: acc.short + Number(s.short),
      referred: acc.referred + Number(s.referred),
    }),
    { students: 0, checked: 0, normal: 0, obese: 0, thin: 0, short: 0, referred: 0 },
  );

  const coverage = totals.students > 0 ? (totals.checked / totals.students) * 100 : 0;
  const normalPct = totals.checked > 0 ? (totals.normal / totals.checked) * 100 : 0;
  const participants = activities.reduce((s, a) => s + Number(a.participant_count ?? 0), 0);

  return (
    <ModulePageShell
      moduleKey="schoolhealth"
      title="📄 รายงานผลการดำเนินงาน"
      subtitle={`ปีการศึกษา ${academicYear} — ตรวจสุขภาพนักเรียน วัคซีนในโรงเรียน และกิจกรรมสุขศึกษา`}
      actions={
        <div className="flex items-center gap-2">
          <YearPicker year={Number(academicYear)} label="ปีการศึกษา" />
          <PrintInlineButton />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="print-only text-center mb-4">
          <div className="font-bold text-lg">รายงานผลการดำเนินงานอนามัยโรงเรียน</div>
          <div>
            {org?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล"}
            {org?.district ? ` อำเภอ${org.district}` : ""}
            {org?.province ? ` จังหวัด${org.province}` : ""}
          </div>
          <div>ปีการศึกษา {academicYear}</div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="โรงเรียนในความรับผิดชอบ" value={`${schools.length} แห่ง`} />
          <Card
            label="นักเรียนที่ตรวจสุขภาพ"
            value={`${nf(totals.checked)} คน`}
            hint={totals.students > 0 ? `ครอบคลุม ${nf(coverage)}% ของนักเรียนทั้งหมด` : undefined}
          />
          <Card
            label="ภาวะโภชนาการสมส่วน"
            value={totals.checked > 0 ? `${nf(normalPct)}%` : "-"}
            hint={`ผิดปกติ ${nf(totals.obese + totals.thin + totals.short)} คน`}
          />
          <Card
            label="ส่งต่อเพื่อรักษา"
            value={`${nf(totals.referred)} คน`}
            hint={`กิจกรรมสุขศึกษา ${activities.length} ครั้ง · ผู้เข้าร่วม ${nf(participants)} คน`}
          />
        </div>

        {/* ตรวจสุขภาพรายโรงเรียน */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            ผลการตรวจสุขภาพนักเรียน รายโรงเรียน
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">โรงเรียน</th>
                  <th className="text-right px-3 py-2 font-medium">นักเรียน</th>
                  <th className="text-right px-3 py-2 font-medium">ตรวจแล้ว</th>
                  <th className="text-right px-3 py-2 font-medium">ครอบคลุม</th>
                  <th className="text-right px-3 py-2 font-medium">สมส่วน</th>
                  <th className="text-right px-3 py-2 font-medium">อ้วน</th>
                  <th className="text-right px-3 py-2 font-medium">ผอม</th>
                  <th className="text-right px-3 py-2 font-medium">เตี้ย</th>
                  <th className="text-right px-3 py-2 font-medium">ส่งต่อ</th>
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-400 py-10">
                      ยังไม่มีข้อมูลโรงเรียน
                    </td>
                  </tr>
                ) : (
                  schools.map((s) => {
                    const students = Number(s.student_count ?? 0);
                    const checked = Number(s.checked);
                    const pct = students > 0 ? (checked / students) * 100 : 0;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2.5 whitespace-nowrap">{s.school_name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {students ? nf(students) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nf(checked)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {students > 0 ? `${nf(pct)}%` : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                          {nf(Number(s.normal))}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nf(Number(s.obese))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nf(Number(s.thin))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nf(Number(s.short))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                          {nf(Number(s.referred))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {schools.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold">
                  <tr className="border-t">
                    <td className="px-3 py-2.5">รวม</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.students)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.checked)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {totals.students > 0 ? `${nf(coverage)}%` : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.normal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.obese)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.thin)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.short)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totals.referred)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* วัคซีนในโรงเรียน */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            ความครอบคลุมวัคซีนในโรงเรียน
          </div>
          {vaccines.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              ยังไม่มีการบันทึกวัคซีนในปีการศึกษานี้
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">วัคซีน</th>
                  <th className="text-right px-3 py-2 font-medium">โรงเรียน</th>
                  <th className="text-right px-3 py-2 font-medium">เป้าหมาย</th>
                  <th className="text-right px-3 py-2 font-medium">ได้รับ</th>
                  <th className="text-right px-3 py-2 font-medium">ความครอบคลุม</th>
                </tr>
              </thead>
              <tbody>
                {vaccines.map((v) => {
                  const target = Number(v.target);
                  const received = Number(v.received);
                  const pct = target > 0 ? (received / target) * 100 : 0;
                  return (
                    <tr key={v.vaccine_name} className="border-t">
                      <td className="px-3 py-2.5">{v.vaccine_name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.schools}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{nf(target)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{nf(received)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`tabular-nums font-medium ${
                            pct >= 95
                              ? "text-emerald-700"
                              : pct >= 80
                                ? "text-amber-600"
                                : "text-rose-600"
                          }`}
                        >
                          {target > 0 ? `${nf(pct)}%` : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* กิจกรรมสุขศึกษา */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            กิจกรรมสุขศึกษาที่ดำเนินการ
          </div>
          {activities.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              ยังไม่มีกิจกรรมที่บันทึกไว้
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">วันที่</th>
                  <th className="text-left px-3 py-2 font-medium">กิจกรรม</th>
                  <th className="text-left px-3 py-2 font-medium">โรงเรียน</th>
                  <th className="text-left px-3 py-2 font-medium">กลุ่มเป้าหมาย</th>
                  <th className="text-right px-3 py-2 font-medium">ผู้เข้าร่วม</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                      {a.activity_date
                        ? new Date(a.activity_date).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="px-3 py-2.5">{a.activity_name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.school_name ?? "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.target_group ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {a.participant_count ? nf(Number(a.participant_count)) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ModulePageShell>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
