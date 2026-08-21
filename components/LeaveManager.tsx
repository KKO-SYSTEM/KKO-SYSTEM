"use client";

import { useCallback, useEffect, useState } from "react";
import { LEAVE_STATUS, LEAVE_TYPES, fiscalYearOf } from "@/lib/leave-types";

interface LeaveRow {
  id: number;
  doc_no: string | null;
  personnel_id: number;
  personnel_name: string;
  personnel_position: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: string;
  reason: string | null;
  status: string;
  approver_name: string | null;
  supervisor_comment: string | null;
}

interface Quota {
  code: string;
  label: string;
  quotaNote: string;
  maxDays: number | null;
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
}

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.code, t.label]),
);

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600",
};

export default function LeaveManager({ canApprove }: { canApprove: boolean }) {
  const thisFY = fiscalYearOf(new Date());
  const [fiscalYear, setFiscalYear] = useState(thisFY);
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        fiscalYear: String(fiscalYear),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/leave?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อ่านข้อมูลไม่สำเร็จ");
      setRows(data.rows);
      setCanWrite(data.canWrite);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  }

  async function decide(row: LeaveRow, status: string) {
    const label = LEAVE_STATUS[status as keyof typeof LEAVE_STATUS];
    let comment: string | null = null;
    if (status === "rejected") {
      comment = window.prompt("เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)") ?? null;
    }
    const res = await fetch(`/api/leave/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || "อัปเดตไม่สำเร็จ");
      return;
    }
    notify(`${label}เรียบร้อยแล้ว`);
    load();
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {[thisFY + 1, thisFY, thisFY - 1, thisFY - 2].map((y) => (
                <option key={y} value={y}>
                  ปีงบประมาณ {y}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">ทุกสถานะ</option>
              {Object.entries(LEAVE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {pendingCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-1">
                รออนุมัติ {pendingCount} ใบ
              </span>
            )}
          </div>

          {canWrite && (
            <button
              onClick={() => setShowForm(true)}
              className="text-sm px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              + เขียนใบลา
            </button>
          )}
        </div>

        {error && (
          <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">เลขที่</th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ผู้ลา</th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ประเภทการลา</th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ตั้งแต่</th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ถึง</th>
                <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap">วันทำการ</th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-2.5 no-print" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    ยังไม่มีใบลาในปีงบประมาณนี้
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{r.doc_no ?? "-"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div>{r.personnel_name}</div>
                      {r.personnel_position && (
                        <div className="text-xs text-slate-400">{r.personnel_position}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {TYPE_LABEL[r.leave_type] ?? r.leave_type}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{thaiDate(r.start_date)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{thaiDate(r.end_date)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">
                      {Number(r.total_days).toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-slate-100"}`}
                      >
                        {LEAVE_STATUS[r.status as keyof typeof LEAVE_STATUS] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap no-print">
                      <a
                        href={`/print/leave/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-brand-700 px-1"
                        title="พิมพ์ใบลา"
                      >
                        🖨
                      </a>
                      {canApprove && r.status === "pending" && (
                        <>
                          <button
                            onClick={() => decide(r, "approved")}
                            className="text-emerald-600 hover:text-emerald-800 px-1"
                            title="อนุมัติ"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => decide(r, "rejected")}
                            className="text-rose-500 hover:text-rose-700 px-1"
                            title="ไม่อนุมัติ"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <LeaveForm
          fiscalYear={fiscalYear}
          onClose={() => setShowForm(false)}
          onSaved={(msg) => {
            setShowForm(false);
            notify(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function thaiDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function LeaveForm({
  fiscalYear,
  onClose,
  onSaved,
}: {
  fiscalYear: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [people, setPeople] = useState<{ id: number; name: string }[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [form, setForm] = useState({
    personnel_id: "",
    leave_type: "",
    written_date: new Date().toISOString().slice(0, 10),
    start_date: "",
    end_date: "",
    reason: "",
    contact_address: "",
    contact_phone: "",
    substitute_name: "",
  });
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/records/personnel?pageSize=200")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.rows ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as number,
          name: `${p.prefix ?? ""}${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        }));
        setPeople(list);
      })
      .catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!form.personnel_id) {
      setQuotas([]);
      return;
    }
    fetch(`/api/leave/quota?personnelId=${form.personnel_id}&fiscalYear=${fiscalYear}`)
      .then((r) => r.json())
      .then((d) => setQuotas(d.quotas ?? []))
      .catch(() => setQuotas([]));
  }, [form.personnel_id, fiscalYear]);

  const selectedQuota = quotas.find((q) => q.code === form.leave_type);
  const selectedType = LEAVE_TYPES.find((t) => t.code === form.leave_type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setBusy(false);
        return;
      }
      if (data.warnings?.length) {
        setWarnings(data.warnings);
        setBusy(false);
        setTimeout(() => onSaved(`บันทึกใบลา ${data.docNo} แล้ว (${data.totalDays} วันทำการ)`), 2200);
        return;
      }
      onSaved(`บันทึกใบลา ${data.docNo} แล้ว (${data.totalDays} วันทำการ)`);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div className="font-semibold text-slate-800">เขียนใบลา — ปีงบประมาณ {fiscalYear}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ผู้ลา <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.personnel_id}
                onChange={(e) => set("personnel_id", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- เลือกบุคลากร --</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ประเภทการลา <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.leave_type}
                onChange={(e) => set("leave_type", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- เลือกประเภท --</option>
                {LEAVE_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label} ({t.quotaNote})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedQuota && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm">
              <div className="font-medium text-brand-800 mb-1">
                สิทธิ์ {selectedQuota.label} — {selectedQuota.quotaNote}
              </div>
              <div className="text-brand-700 text-xs space-x-3">
                <span>ใช้ไปแล้ว {selectedQuota.usedDays} วัน</span>
                {selectedQuota.pendingDays > 0 && <span>รออนุมัติ {selectedQuota.pendingDays} วัน</span>}
                {selectedQuota.remainingDays !== null && (
                  <span className="font-semibold">คงเหลือ {selectedQuota.remainingDays} วัน</span>
                )}
              </div>
              {selectedType?.note && (
                <div className="text-[11px] text-brand-600 mt-1.5">ℹ️ {selectedType.note}</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เขียนใบลา</label>
              <input
                type="date"
                value={form.written_date}
                onChange={(e) => set("written_date", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ลาตั้งแต่วันที่ <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ถึงวันที่ <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 -mt-2">
            ระบบจะนับเฉพาะวันทำการให้อัตโนมัติ (ไม่นับเสาร์-อาทิตย์ และวันหยุดราชการที่บันทึกไว้)
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">เนื่องจาก (เหตุผลการลา)</label>
            <textarea
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ที่อยู่ติดต่อระหว่างลา
              </label>
              <input
                value={form.contact_address}
                onChange={(e) => set("contact_address", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">เบอร์ติดต่อ</label>
              <input
                value={form.contact_phone}
                onChange={(e) => set("contact_phone", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ผู้ปฏิบัติงานแทน</label>
            <input
              value={form.substitute_name}
              onChange={(e) => set("substitute_name", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2 space-y-1">
              {warnings.map((w, i) => (
                <div key={i}>⚠️ {w}</div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </form>

        <div className="px-5 py-4 border-t flex gap-2 justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-50">
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "กำลังบันทึก..." : "บันทึกใบลา"}
          </button>
        </div>
      </div>
    </div>
  );
}
