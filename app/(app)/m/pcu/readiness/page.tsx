import ModulePageShell from "@/components/ModulePageShell";
import PrintInlineButton from "@/components/PrintInlineButton";
import { query, queryOne } from "@/lib/db";
import { fiscalYearOf, getPcuAssessment } from "@/lib/pcu";
import YearPicker from "@/components/YearPicker";

export const dynamic = "force-dynamic";

const nf = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });

/**
 * รายงานเตรียมรับการประเมินมาตรฐาน PCU
 * สรุปว่าหมวดไหนผ่านแล้ว ข้อไหนยังขาด และข้อไหนยังไม่มีหลักฐานประกอบ
 */
export default async function PcuReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: rawYear } = await searchParams;
  const year = Number(rawYear) || fiscalYearOf();

  const summary = await getPcuAssessment(year);

  const org = await queryOne<{ org_name: string; district: string; province: string }>(
    `SELECT org_name, district, province FROM org_settings WHERE id = 1`,
  );

  const evidenceRows = await query<{ criteria_id: number; total: string }>(
    `SELECT criteria_id, COUNT(*)::text AS total
     FROM pcu_evidence WHERE fiscal_year = $1 GROUP BY criteria_id`,
    [year],
  );
  const evidenceCount = new Map(evidenceRows.map((r) => [r.criteria_id, Number(r.total)]));

  const notScored = summary.items.filter((i) => i.score === null);
  const incomplete = summary.items.filter(
    (i) => i.score !== null && i.score < i.full_score,
  );
  const noEvidence = summary.items.filter(
    (i) => !evidenceCount.has(i.id) && !(i.evidence && i.evidence.trim()),
  );
  const failedCategories = summary.categories.filter((c) => !c.passed);

  return (
    <ModulePageShell
      moduleKey="pcu"
      title="🎯 รายงานเตรียมรับประเมิน"
      subtitle={`ปีงบประมาณ ${year} — สรุปความพร้อมตามคู่มือมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566`}
      actions={
        <div className="flex items-center gap-2">
          <YearPicker year={year} />
          <PrintInlineButton />
        </div>
      }
    >
      <div className="space-y-4">
        {/* หัวรายงานสำหรับพิมพ์ */}
        <div className="print-only text-center mb-4">
          <div className="font-bold text-lg">รายงานเตรียมรับการประเมินมาตรฐานหน่วยบริการปฐมภูมิ</div>
          <div>
            {org?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล"}
            {org?.district ? ` อำเภอ${org.district}` : ""}
            {org?.province ? ` จังหวัด${org.province}` : ""}
          </div>
          <div>ปีงบประมาณ {year}</div>
        </div>

        {/* การ์ดสรุป */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="คะแนนรวม"
            value={`${nf(summary.earned)} / ${nf(summary.fullScore)}`}
            hint={`${nf(summary.percent)}% ของคะแนนเต็ม`}
          />
          <SummaryCard
            label="ประเมินแล้ว"
            value={`${summary.scoredCount} / ${summary.itemCount} ข้อ`}
            hint={notScored.length > 0 ? `ยังไม่ประเมิน ${notScored.length} ข้อ` : "ประเมินครบทุกข้อ"}
          />
          <SummaryCard
            label="หมวดที่ยังไม่ผ่าน"
            value={`${failedCategories.length} หมวด`}
            hint={
              failedCategories.length > 0
                ? `หมวด ${failedCategories.map((c) => c.no).join(", ")}`
                : "ผ่านครบทุกหมวด"
            }
            tone={failedCategories.length > 0 ? "bad" : "good"}
          />
          <SummaryCard
            label="ข้อที่ยังไม่มีหลักฐาน"
            value={`${noEvidence.length} ข้อ`}
            hint={noEvidence.length > 0 ? "ควรจัดเตรียมก่อนรับประเมิน" : "มีหลักฐานครบทุกข้อ"}
            tone={noEvidence.length > 0 ? "warn" : "good"}
          />
        </div>

        {/* ตารางสรุปรายหมวด */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-slate-800 text-sm">
            สรุปผลรายหมวด
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">หมวด</th>
                  <th className="text-right px-4 py-2 font-medium">คะแนนเต็ม</th>
                  <th className="text-right px-4 py-2 font-medium">ได้</th>
                  <th className="text-right px-4 py-2 font-medium">ร้อยละ</th>
                  <th className="text-left px-4 py-2 font-medium">เกณฑ์ผ่าน</th>
                  <th className="text-left px-4 py-2 font-medium">ผล</th>
                </tr>
              </thead>
              <tbody>
                {summary.categories.map((c) => (
                  <tr key={c.no} className="border-t">
                    <td className="px-4 py-2.5">
                      <span className="text-slate-400 mr-1.5">{c.no}</span>
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf(c.fullScore)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {nf(c.earned)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{nf(c.percent)}%</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {c.passPct === 100 ? "ต้องผ่านทุกข้อ" : `ไม่น้อยกว่า ${c.passPct}%`}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.scoredCount === 0
                            ? "bg-slate-100 text-slate-600"
                            : c.passed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {c.scoredCount === 0 ? "ยังไม่ประเมิน" : c.passed ? "ผ่าน" : "ไม่ผ่าน"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr className="border-t">
                  <td className="px-4 py-2.5">รวมทั้งสิ้น</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{nf(summary.fullScore)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{nf(summary.earned)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{nf(summary.percent)}%</td>
                  <td className="px-4 py-2.5" colSpan={2}>
                    {summary.passed ? "ผ่านเกณฑ์ทุกหมวด" : "ยังไม่ผ่านเกณฑ์ครบทุกหมวด"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* รายการที่ต้องเร่งดำเนินการ */}
        <GapList
          title="ข้อที่ยังไม่ได้คะแนนเต็ม"
          hint="เรียงตามหมวด — ควรแก้ไขให้ครบก่อนวันรับประเมิน"
          items={incomplete.map(
            (i) =>
              `หมวด ${i.category_no} ข้อ ${i.item_no} ${i.item_name} (ได้ ${nf(i.score ?? 0)} จาก ${nf(i.full_score)})`,
          )}
          emptyText="ทุกข้อที่ประเมินแล้วได้คะแนนเต็ม"
        />

        <GapList
          title="ข้อที่ยังไม่ได้ประเมิน"
          hint="ต้องให้คะแนนให้ครบทุกข้อจึงจะสรุปผลได้ถูกต้อง"
          items={notScored.map((i) => `หมวด ${i.category_no} ข้อ ${i.item_no} ${i.item_name}`)}
          emptyText="ประเมินครบทุกข้อแล้ว"
        />

        <GapList
          title="ข้อที่ยังไม่มีหลักฐานประกอบ"
          hint="เพิ่มหลักฐานได้ที่เมนู หลักฐานประกอบ หรือกรอกช่องหลักฐานในหน้าให้คะแนน"
          items={noEvidence.map((i) => `หมวด ${i.category_no} ข้อ ${i.item_no} ${i.item_name}`)}
          emptyText="ทุกข้อมีหลักฐานประกอบแล้ว"
        />

        <div className="card p-4 text-sm text-slate-600 leading-relaxed">
          <div className="font-semibold text-slate-800 mb-1.5">ข้อเสนอแนะ</div>
          {summary.scoredCount === 0 ? (
            <p>ยังไม่เริ่มประเมิน — เริ่มที่เมนู &ldquo;คะแนนประเมิน&rdquo; แล้วกลับมาดูรายงานนี้อีกครั้ง</p>
          ) : summary.passed && noEvidence.length === 0 ? (
            <p>
              ผ่านเกณฑ์ทุกหมวดและมีหลักฐานครบถ้วน — พร้อมรับการประเมิน ควรจัดแฟ้มหลักฐานเรียงตามหมวดและข้อ
              เพื่อให้คณะกรรมการตรวจสอบได้สะดวก
            </p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {failedCategories.length > 0 && (
                <li>
                  เร่งพัฒนาหมวดที่ยังไม่ผ่าน ({failedCategories.map((c) => `หมวด ${c.no}`).join(", ")})
                  โดยเฉพาะหมวด 1-4 ที่ต้องได้คะแนนเต็มทุกข้อ
                </li>
              )}
              {notScored.length > 0 && <li>ให้คะแนนข้อที่ยังไม่ได้ประเมินอีก {notScored.length} ข้อ</li>}
              {noEvidence.length > 0 && (
                <li>จัดเตรียมหลักฐานประกอบอีก {noEvidence.length} ข้อ และแนบไฟล์เข้าระบบ</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </ModulePageShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="card p-4">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function GapList({
  title,
  hint,
  items,
  emptyText,
}: {
  title: string;
  hint: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <div className="font-semibold text-slate-800 text-sm">
          {title}
          <span className="ml-2 text-xs font-normal text-slate-400">{items.length} รายการ</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-5 text-sm text-emerald-700 bg-emerald-50/50">✓ {emptyText}</div>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((text, idx) => (
            <li key={idx} className="px-4 py-2.5 text-slate-700">
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
