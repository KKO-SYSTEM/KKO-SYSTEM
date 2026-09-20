import ModulePageShell from "@/components/ModulePageShell";
import PrintInlineButton from "@/components/PrintInlineButton";
import YearPicker from "@/components/YearPicker";
import { query, queryOne } from "@/lib/db";
import { LEAVE_TYPES, fiscalYearOf } from "@/lib/leave-types";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });

/** ประเภทที่แยกเป็นคอลัมน์ในตาราง ที่เหลือรวมเป็น "อื่น ๆ" */
const MAIN_TYPES = ["sick", "personal", "vacation", "maternity", "ordination"];

interface Row {
  personnel_id: number;
  name: string;
  position: string | null;
  department: string | null;
  leave_type: string | null;
  approved_days: string;
  pending_days: string;
  times: string;
}

interface PersonSummary {
  id: number;
  name: string;
  position: string | null;
  department: string | null;
  byType: Record<string, number>;
  other: number;
  total: number;
  pending: number;
  times: number;
}

/**
 * รายงานสรุปวันลาของเจ้าหน้าที่ทั้งหน่วยงาน แยกตามประเภทการลา
 * นับเฉพาะใบลาที่อนุมัติแล้ว ส่วนใบที่ยังรออนุมัติแสดงแยกไว้ไม่ให้ปนกัน
 */
export default async function LeaveSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: rawYear } = await searchParams;
  const year = Number(rawYear) || fiscalYearOf(new Date());

  const rows = await query<Row>(
    `SELECT p.id AS personnel_id,
            TRIM(CONCAT(COALESCE(p.prefix,''), p.first_name, ' ', p.last_name)) AS name,
            p.position, p.department,
            lr.leave_type,
            COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days END), 0)::text AS approved_days,
            COALESCE(SUM(CASE WHEN lr.status = 'pending'  THEN lr.total_days END), 0)::text AS pending_days,
            COUNT(CASE WHEN lr.status = 'approved' THEN 1 END)::text AS times
     FROM personnel p
     LEFT JOIN leave_request lr ON lr.personnel_id = p.id AND lr.fiscal_year = $1
     WHERE p.status <> 'ย้าย/ลาออก'
     GROUP BY p.id, p.prefix, p.first_name, p.last_name, p.position, p.department, lr.leave_type
     ORDER BY p.department NULLS LAST, p.first_name`,
    [year],
  );

  const org = await queryOne<{ org_name: string; district: string; province: string }>(
    `SELECT org_name, district, province FROM org_settings WHERE id = 1`,
  );

  const map = new Map<number, PersonSummary>();
  for (const r of rows) {
    let person = map.get(r.personnel_id);
    if (!person) {
      person = {
        id: r.personnel_id,
        name: r.name,
        position: r.position,
        department: r.department,
        byType: {},
        other: 0,
        total: 0,
        pending: 0,
        times: 0,
      };
      map.set(r.personnel_id, person);
    }
    if (!r.leave_type) continue;

    const days = Number(r.approved_days);
    const pending = Number(r.pending_days);

    if (MAIN_TYPES.includes(r.leave_type)) {
      person.byType[r.leave_type] = (person.byType[r.leave_type] ?? 0) + days;
    } else {
      person.other += days;
    }
    person.total += days;
    person.pending += pending;
    person.times += Number(r.times);
  }

  const people = [...map.values()];
  const totalDays = people.reduce((s, p) => s + p.total, 0);
  const totalPending = people.reduce((s, p) => s + p.pending, 0);
  const onLeaveCount = people.filter((p) => p.total > 0).length;
  const columnLabel = (code: string) =>
    LEAVE_TYPES.find((t) => t.code === code)?.label ?? code;

  return (
    <ModulePageShell
      moduleKey="personnel"
      title="📊 รายงานสรุปวันลา"
      subtitle={`ปีงบประมาณ ${year} — นับเฉพาะใบลาที่อนุมัติแล้ว ตามระเบียบสำนักนายกรัฐมนตรีฯ พ.ศ. 2555`}
      actions={
        <div className="flex items-center gap-2">
          <YearPicker year={year} />
          <PrintInlineButton />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="print-only text-center mb-4">
          <div className="font-bold text-lg">รายงานสรุปวันลาของเจ้าหน้าที่</div>
          <div>
            {org?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล"}
            {org?.district ? ` อำเภอ${org.district}` : ""}
            {org?.province ? ` จังหวัด${org.province}` : ""}
          </div>
          <div>ปีงบประมาณ {year}</div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="เจ้าหน้าที่ทั้งหมด" value={`${people.length} คน`} />
          <Card label="มีการลาในปีนี้" value={`${onLeaveCount} คน`} />
          <Card label="วันลารวมทั้งหน่วยงาน" value={`${nf(totalDays)} วัน`} />
          <Card
            label="รออนุมัติ"
            value={`${nf(totalPending)} วัน`}
            hint={totalPending > 0 ? "ยังไม่นับรวมในยอดด้านซ้าย" : "ไม่มีใบลาค้างอนุมัติ"}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            สรุปรายบุคคล
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ชื่อ - สกุล</th>
                  <th className="text-left px-3 py-2 font-medium">ตำแหน่ง</th>
                  {MAIN_TYPES.map((code) => (
                    <th key={code} className="text-right px-3 py-2 font-medium whitespace-nowrap">
                      {columnLabel(code)}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium">อื่น ๆ</th>
                  <th className="text-right px-3 py-2 font-medium">รวม (วัน)</th>
                  <th className="text-right px-3 py-2 font-medium">ครั้ง</th>
                  <th className="text-right px-3 py-2 font-medium">รออนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {people.length === 0 ? (
                  <tr>
                    <td colSpan={MAIN_TYPES.length + 6} className="text-center text-slate-400 py-10">
                      ยังไม่มีข้อมูลบุคลากร
                    </td>
                  </tr>
                ) : (
                  people.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2.5 whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {p.position ?? "-"}
                      </td>
                      {MAIN_TYPES.map((code) => (
                        <td key={code} className="px-3 py-2.5 text-right tabular-nums">
                          {p.byType[code] ? nf(p.byType[code]) : "-"}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {p.other ? nf(p.other) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                        {p.total ? nf(p.total) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                        {p.times || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">
                        {p.pending ? nf(p.pending) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {people.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold">
                  <tr className="border-t">
                    <td className="px-3 py-2.5" colSpan={2}>
                      รวมทั้งหน่วยงาน
                    </td>
                    {MAIN_TYPES.map((code) => {
                      const sum = people.reduce((s, p) => s + (p.byType[code] ?? 0), 0);
                      return (
                        <td key={code} className="px-3 py-2.5 text-right tabular-nums">
                          {sum ? nf(sum) : "-"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {nf(people.reduce((s, p) => s + p.other, 0)) || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totalDays)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {people.reduce((s, p) => s + p.times, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nf(totalPending)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="print-only mt-10 flex justify-end gap-24 text-center">
          <div>
            <div>ลงชื่อ ................................................</div>
            <div className="mt-1">( ................................................ )</div>
            <div className="mt-1">ผู้จัดทำรายงาน</div>
          </div>
          <div>
            <div>ลงชื่อ ................................................</div>
            <div className="mt-1">( ................................................ )</div>
            <div className="mt-1">ผู้อำนวยการ</div>
          </div>
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
