import ModulePageShell from "@/components/ModulePageShell";
import PrintInlineButton from "@/components/PrintInlineButton";
import YearPicker from "@/components/YearPicker";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const nf = (n: number) => n.toLocaleString("th-TH");

/**
 * สรุปสถานการณ์โรคติดต่อรายเดือน / รายปี จากทะเบียนผู้ป่วย (รง.506)
 * ใช้ปีปฏิทินตามระบบเฝ้าระวังของกรมควบคุมโรค (ไม่ใช่ปีงบประมาณ)
 */
export default async function EpidemiologySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: rawYear } = await searchParams;
  const buddhistYear = Number(rawYear) || new Date().getFullYear() + 543;
  const year = buddhistYear - 543;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [matrixRows, statusRows, villageRows, ageRows, prevRow] = await Promise.all([
    query<{ disease_name: string; m: number; c: string }>(
      `SELECT disease_name, EXTRACT(MONTH FROM onset_date)::int AS m, COUNT(*)::text AS c
       FROM disease_case
       WHERE onset_date BETWEEN $1 AND $2
       GROUP BY disease_name, m
       ORDER BY disease_name`,
      [start, end],
    ),
    query<{ label: string; c: string }>(
      `SELECT COALESCE(NULLIF(TRIM(treat_result), ''), 'ไม่ระบุ') AS label, COUNT(*)::text AS c
       FROM disease_case WHERE onset_date BETWEEN $1 AND $2
       GROUP BY label ORDER BY COUNT(*) DESC`,
      [start, end],
    ),
    query<{ label: string; c: string }>(
      `SELECT COALESCE(NULLIF(TRIM(village_no), ''), 'ไม่ระบุ') AS label, COUNT(*)::text AS c
       FROM disease_case WHERE onset_date BETWEEN $1 AND $2
       GROUP BY label ORDER BY COUNT(*) DESC LIMIT 12`,
      [start, end],
    ),
    query<{ label: string; c: string }>(
      `SELECT CASE
                WHEN age_year IS NULL THEN 'ไม่ระบุ'
                WHEN age_year < 5   THEN '0-4 ปี'
                WHEN age_year < 15  THEN '5-14 ปี'
                WHEN age_year < 25  THEN '15-24 ปี'
                WHEN age_year < 45  THEN '25-44 ปี'
                WHEN age_year < 60  THEN '45-59 ปี'
                ELSE '60 ปีขึ้นไป'
              END AS label,
              COUNT(*)::text AS c
       FROM disease_case WHERE onset_date BETWEEN $1 AND $2
       GROUP BY label ORDER BY MIN(COALESCE(age_year, 999))`,
      [start, end],
    ),
    queryOne<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM disease_case
       WHERE onset_date BETWEEN $1 AND $2`,
      [`${year - 1}-01-01`, `${year - 1}-12-31`],
    ),
  ]);

  const org = await queryOne<{ org_name: string; district: string; province: string }>(
    `SELECT org_name, district, province FROM org_settings WHERE id = 1`,
  );

  /* สร้างตารางโรค × เดือน */
  const diseases = [...new Set(matrixRows.map((r) => r.disease_name))];
  const table = diseases
    .map((name) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const hit = matrixRows.find((r) => r.disease_name === name && r.m === i + 1);
        return hit ? Number(hit.c) : 0;
      });
      return { name, months, total: months.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total);

  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    table.reduce((sum, row) => sum + row.months[i], 0),
  );
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0);
  const peakIndex = monthTotals.indexOf(Math.max(...monthTotals));
  const lastYear = Number(prevRow?.c ?? 0);
  const changePct = lastYear > 0 ? Math.round(((grandTotal - lastYear) / lastYear) * 1000) / 10 : null;

  return (
    <ModulePageShell
      moduleKey="epidemiology"
      title="📅 สรุปรายเดือน / รายปี"
      subtitle={`ปี พ.ศ. ${buddhistYear} — สรุปจากทะเบียนผู้ป่วยโรคติดต่อ (รง.506)`}
      actions={
        <div className="flex items-center gap-2">
          <YearPicker year={buddhistYear} label="ปี พ.ศ." />
          <PrintInlineButton />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="print-only text-center mb-4">
          <div className="font-bold text-lg">รายงานสรุปสถานการณ์โรคติดต่อ</div>
          <div>
            {org?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล"}
            {org?.district ? ` อำเภอ${org.district}` : ""}
            {org?.province ? ` จังหวัด${org.province}` : ""}
          </div>
          <div>ปี พ.ศ. {buddhistYear}</div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="ผู้ป่วยทั้งปี" value={`${nf(grandTotal)} ราย`} />
          <Card
            label="เทียบปีที่แล้ว"
            value={changePct === null ? "-" : `${changePct > 0 ? "+" : ""}${changePct}%`}
            hint={lastYear > 0 ? `ปีที่แล้ว ${nf(lastYear)} ราย` : "ไม่มีข้อมูลปีที่แล้ว"}
          />
          <Card
            label="เดือนที่พบมากที่สุด"
            value={grandTotal > 0 ? MONTHS[peakIndex] : "-"}
            hint={grandTotal > 0 ? `${nf(monthTotals[peakIndex])} ราย` : undefined}
          />
          <Card
            label="โรคที่พบมากที่สุด"
            value={table[0]?.name ?? "-"}
            hint={table[0] ? `${nf(table[0].total)} ราย` : undefined}
          />
        </div>

        {/* ตารางโรค × เดือน */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            จำนวนผู้ป่วยรายโรค แยกรายเดือน
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">โรค</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-2 py-2 font-medium">
                      {m}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium">รวม</th>
                </tr>
              </thead>
              <tbody>
                {table.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center text-slate-400 py-10">
                      ยังไม่มีผู้ป่วยที่บันทึกไว้ในปีนี้
                    </td>
                  </tr>
                ) : (
                  table.map((row) => (
                    <tr key={row.name} className="border-t">
                      <td className="px-3 py-2.5 whitespace-nowrap">{row.name}</td>
                      {row.months.map((v, i) => (
                        <td
                          key={i}
                          className={`px-2 py-2.5 text-right tabular-nums ${v === 0 ? "text-slate-300" : ""}`}
                        >
                          {v === 0 ? "-" : nf(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {nf(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {table.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold">
                  <tr className="border-t">
                    <td className="px-3 py-2.5">รวมทุกโรค</td>
                    {monthTotals.map((v, i) => (
                      <td key={i} className="px-2 py-2.5 text-right tabular-nums">
                        {v === 0 ? "-" : nf(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(grandTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BreakdownTable title="แยกตามผลการรักษา" rows={statusRows} total={grandTotal} />
          <BreakdownTable title="แยกตามกลุ่มอายุ" rows={ageRows} total={grandTotal} />
          <BreakdownTable title="แยกตามหมู่ที่" rows={villageRows} total={grandTotal} />
        </div>
      </div>
    </ModulePageShell>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1 truncate" title={value}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; c: string }[];
  total: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => {
              const count = Number(r.c);
              const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
              return (
                <tr key={r.label} className="border-t">
                  <td className="px-4 py-2.5">{r.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{nf(count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400 w-16">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
