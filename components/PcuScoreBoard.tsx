"use client";

import { useCallback, useEffect, useState } from "react";

interface Item {
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

interface Category {
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

interface Summary {
  fiscalYear: number;
  items: Item[];
  categories: Category[];
  fullScore: number;
  earned: number;
  percent: number;
  scoredCount: number;
  itemCount: number;
  passed: boolean;
  canWrite: boolean;
}

const nf = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });

function toneOf(passed: boolean, scored: number): string {
  if (scored === 0) return "bg-slate-100 text-slate-600";
  return passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
}

export default function PcuScoreBoard({ initialYear }: { initialYear: number }) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, { score: string; evidence: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pcu/score?year=${year}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "อ่านข้อมูลไม่สำเร็จ");
      setData(json);
      setDraft(
        Object.fromEntries(
          (json.items as Item[]).map((i) => [
            i.id,
            { score: i.score === null ? "" : String(i.score), evidence: i.evidence ?? "" },
          ]),
        ),
      );
      if (open === null && json.categories.length > 0) setOpen(json.categories[0].no);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  async function save(item: Item, overrideScore?: number) {
    const d = draft[item.id] ?? { score: "", evidence: "" };
    const scoreValue = overrideScore !== undefined ? String(overrideScore) : d.score;
    setSaving(item.id);
    setError("");
    try {
      const res = await fetch("/api/pcu/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscal_year: year,
          criteria_id: item.id,
          score: scoreValue === "" ? null : Number(scoreValue),
          evidence: d.evidence,
          assess_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setData(json);
      setDraft((prev) => ({
        ...prev,
        [item.id]: { score: scoreValue, evidence: d.evidence },
      }));
      notify(`บันทึกข้อ ${item.item_no} แล้ว`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  }

  if (loading && !data) {
    return <div className="text-center text-slate-400 py-16 text-sm">กำลังโหลดเกณฑ์การประเมิน...</div>;
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm rounded-xl px-4 py-3">
        ให้คะแนนตามคู่มือคุณภาพมาตรฐานบริการสุขภาพปฐมภูมิ พ.ศ. 2566 — หมวด 1-4 ต้องได้คะแนนเต็มทุกข้อ
        ส่วนหมวด 5-8 ต้องได้รวมไม่น้อยกว่า 80% ของคะแนนเต็มในหมวดนั้น
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="shrink-0 underline">
            ปิด
          </button>
        </div>
      )}

      {/* สรุปรวม */}
      {data && (
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ปีงบประมาณ</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm w-28"
                />
              </div>
              <div className="text-xs text-slate-400 pb-2.5">
                ประเมินแล้ว {data.scoredCount} / {data.itemCount} ข้อ
              </div>
            </div>

            <div className="flex items-end gap-6">
              <div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                  {nf(data.earned)}
                  <span className="text-base font-normal text-slate-400"> / {nf(data.fullScore)}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">คะแนนรวม</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-700 tabular-nums leading-none">
                  {nf(data.percent)}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">ร้อยละของคะแนนเต็ม</div>
              </div>
              <div
                className={`px-3 py-2 rounded-lg text-sm font-medium ${toneOf(data.passed, data.scoredCount)}`}
              >
                {data.scoredCount === 0
                  ? "ยังไม่ได้ประเมิน"
                  : data.passed
                    ? "ผ่านเกณฑ์ทุกหมวด"
                    : "ยังไม่ผ่านเกณฑ์"}
              </div>
            </div>
          </div>

          <div className="meter mt-4">
            <span
              style={{ width: `${Math.min(100, data.percent)}%` }}
              className={data.passed ? "bg-emerald-500" : "bg-amber-500"}
            />
          </div>
        </div>
      )}

      {/* รายหมวด */}
      <div className="space-y-3">
        {data?.categories.map((cat) => {
          const isOpen = open === cat.no;
          const items = data.items.filter((i) => i.category_no === cat.no);

          return (
            <div key={cat.no} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : cat.no)}
                className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50"
              >
                <span className="text-slate-400 text-xs w-4">{isOpen ? "▼" : "▶"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 text-sm">
                    หมวด {cat.no} {cat.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {cat.itemCount} ข้อ · เกณฑ์ผ่าน{" "}
                    {cat.passPct === 100 ? "ต้องผ่านทุกข้อ" : `${cat.passPct}% ของหมวด`}
                    {cat.failedItems.length > 0 && ` · ยังไม่เต็ม: ข้อ ${cat.failedItems.join(", ")}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-800 tabular-nums">
                    {nf(cat.earned)} / {nf(cat.fullScore)}
                  </div>
                  <div className="text-[11px] text-slate-500">{nf(cat.percent)}%</div>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${toneOf(cat.passed, cat.scoredCount)}`}
                >
                  {cat.scoredCount === 0 ? "ยังไม่ประเมิน" : cat.passed ? "ผ่าน" : "ไม่ผ่าน"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t divide-y">
                  {items.map((item) => {
                    const d = draft[item.id] ?? { score: "", evidence: "" };
                    const scoreNum = d.score === "" ? null : Number(d.score);
                    const full = scoreNum !== null && scoreNum >= item.full_score;

                    return (
                      <div key={item.id} className="px-4 py-3 sm:flex sm:items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-800">
                            <span className="font-medium text-slate-500 mr-1.5">{item.item_no}</span>
                            {item.item_name}
                          </div>
                          {data.canWrite && (
                            <input
                              value={d.evidence}
                              onChange={(e) =>
                                setDraft((p) => ({
                                  ...p,
                                  [item.id]: { ...d, evidence: e.target.value },
                                }))
                              }
                              placeholder="หลักฐานอ้างอิง (ถ้ามี)"
                              className="mt-1.5 w-full border rounded-lg px-2.5 py-1.5 text-xs"
                            />
                          )}
                          {!data.canWrite && item.evidence && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              หลักฐาน: {item.evidence}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
                          {data.canWrite && item.full_score === 1 && (
                            <>
                              <button
                                onClick={() => save(item, 1)}
                                disabled={saving === item.id}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                                  full
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "hover:bg-emerald-50"
                                }`}
                              >
                                ผ่าน
                              </button>
                              <button
                                onClick={() => save(item, 0)}
                                disabled={saving === item.id}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                                  scoreNum === 0 ? "bg-rose-600 text-white border-rose-600" : "hover:bg-rose-50"
                                }`}
                              >
                                ไม่ผ่าน
                              </button>
                            </>
                          )}

                          {item.full_score > 1 && (
                            <input
                              type="number"
                              min={0}
                              max={item.full_score}
                              step="any"
                              value={d.score}
                              disabled={!data.canWrite}
                              onChange={(e) =>
                                setDraft((p) => ({ ...p, [item.id]: { ...d, score: e.target.value } }))
                              }
                              className="border rounded-lg px-2 py-1.5 text-sm w-20 text-right tabular-nums"
                            />
                          )}

                          <span className="text-xs text-slate-400 w-14 text-right tabular-nums">
                            เต็ม {nf(item.full_score)}
                          </span>

                          {data.canWrite && (
                            <button
                              onClick={() => save(item)}
                              disabled={saving === item.id}
                              className="text-xs px-3 py-1.5 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50"
                            >
                              {saving === item.id ? "..." : "บันทึก"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data && data.itemCount === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-sm text-slate-500">
          ยังไม่มีเกณฑ์การประเมินในฐานข้อมูล — ติดตั้งระบบใหม่หรือเพิ่มเกณฑ์ที่หน้าทะเบียนเกณฑ์มาตรฐาน
        </div>
      )}
    </div>
  );
}
