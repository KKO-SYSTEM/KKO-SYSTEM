"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldDef } from "@/lib/modules";
import { STATUS_TONE } from "@/lib/modules";
import type { SubTableDef } from "@/lib/subtables";
import { SUB_STATUS_LABEL } from "@/lib/subtables";
import AttachmentBox from "./AttachmentBox";

interface Row extends Record<string, unknown> {
  id: number;
}

/** แปลงค่าสถานะที่เก็บเป็นอังกฤษให้แสดงเป็นไทย */
function statusText(value: unknown): string {
  const raw = String(value ?? "");
  const map: Record<string, string> = {
    ...SUB_STATUS_LABEL,
    borrowed: "ยืมอยู่",
    returned: "คืนแล้ว",
    overdue: "เกินกำหนดคืน",
    in_progress: "กำลังตรวจสอบ",
    completed: "ตรวจสอบเสร็จ",
  };
  return map[raw] ?? raw;
}

function toneClass(value: unknown): string {
  const text = statusText(value);
  const extraTone: Record<string, "good" | "warn" | "bad"> = {
    "อนุมัติแล้ว": "good",
    "จ่ายแล้ว": "good",
    "คืนแล้ว": "good",
    "ตรวจสอบเสร็จ": "good",
    "สมส่วน": "good",
    "รออนุมัติ": "warn",
    "ยืมอยู่": "warn",
    "กำลังตรวจสอบ": "warn",
    "ไม่อนุมัติ": "bad",
    "เกินกำหนดคืน": "bad",
    "อ้วน": "bad",
    "ผอม": "bad",
    "เตี้ย": "bad",
  };
  const tone = extraTone[text] ?? STATUS_TONE[text];
  if (tone === "good") return "bg-emerald-100 text-emerald-700";
  if (tone === "warn") return "bg-amber-100 text-amber-700";
  if (tone === "bad") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function fmt(field: FieldDef, row: Row): string {
  if (field.type === "lookup") {
    const label = row[`${field.key}_label`];
    return label ? String(label) : "-";
  }

  const value = row[field.key];
  if (value === null || value === undefined || value === "") return "-";

  if (field.type === "date") {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  }
  if (field.type === "number") return Number(value).toLocaleString("th-TH");
  return String(value);
}

export default function SubTableManager({ def }: { def: SubTableDef }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [toast, setToast] = useState("");
  const [attaching, setAttaching] = useState<Row | null>(null);
  const [options, setOptions] = useState<Record<string, { id: number; label: string }[]>>({});

  const pageSize = 25;
  const apiKey = def.key.replace("/", "~");
  const tableFields = useMemo(() => def.fields.filter((f) => !f.hideInTable), [def]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ดึงตัวเลือกของฟิลด์ lookup */
  useEffect(() => {
    const lookupFields = def.fields.filter((f) => f.type === "lookup" && f.lookup);
    if (lookupFields.length === 0) return;

    let cancelled = false;
    (async () => {
      const next: Record<string, { id: number; label: string }[]> = {};
      for (const f of lookupFields) {
        try {
          const res = await fetch(`/api/lookup/${f.lookup!.table}`);
          const data = await res.json();
          if (res.ok) next[f.key] = data.rows ?? [];
        } catch {
          /* ปล่อยว่างไว้ ให้ผู้ใช้เห็นว่าไม่มีตัวเลือก */
        }
      }
      if (!cancelled) setOptions(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [def]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debounced ? { search: debounced } : {}),
      });
      const res = await fetch(`/api/sub/${apiKey}?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อ่านข้อมูลไม่สำเร็จ");
      setRows(data.rows);
      setTotal(data.total);
      setCanWrite(data.canWrite);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [apiKey, page, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.computed) continue;
      body[f.key] = form.get(f.key);
    }

    const isNew = editing === "new";
    const url = isNew ? `/api/sub/${apiKey}` : `/api/sub/${apiKey}/${(editing as Row).id}`;

    try {
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setEditing(null);
      notify(isNew ? "เพิ่มรายการแล้ว" : "บันทึกการแก้ไขแล้ว");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/sub/${apiKey}/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setDeleting(null);
      notify("ลบรายการแล้ว");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {def.description && (
        <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm rounded-xl px-4 py-3">
          {def.description}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="shrink-0 underline">
            ปิด
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b">
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="border rounded-lg px-3 py-2 text-sm w-56 max-w-full"
            />
            <span className="text-xs text-slate-400 whitespace-nowrap">{total} รายการ</span>
          </div>
          {canWrite && (
            <button
              onClick={() => setEditing("new")}
              className="text-sm px-3 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 whitespace-nowrap"
            >
              + เพิ่มรายการ
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {tableFields.map((f) => (
                  <th key={f.key} className="text-left px-4 py-2 font-medium whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableFields.length + 1} className="text-center text-slate-400 py-10">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={tableFields.length + 1} className="text-center text-slate-400 py-10">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    {tableFields.map((f) => (
                      <td key={f.key} className="px-4 py-2.5 whitespace-nowrap">
                        {f.badge ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${toneClass(row[f.key])}`}
                          >
                            {statusText(row[f.key])}
                          </span>
                        ) : (
                          fmt(f, row)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap no-print">
                      {def.detailPath && (
                        <a
                          href={`${def.detailPath}/${row.id}`}
                          title="เปิดรายละเอียด / จัดการรายการ"
                          className="text-brand-700 hover:underline px-1 text-xs font-medium"
                        >
                          เปิด
                        </a>
                      )}
                      {def.printPath && (
                        <a
                          href={`${def.printPath}/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={def.printLabel ?? "พิมพ์"}
                          className="text-slate-400 hover:text-brand-700 px-1"
                        >
                          🖨
                        </a>
                      )}
                      <button
                        onClick={() => setAttaching(row)}
                        title="ไฟล์แนบ"
                        className="text-slate-400 hover:text-brand-700 px-1"
                      >
                        📎
                      </button>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => setEditing(row)}
                            title="แก้ไข"
                            className="text-slate-400 hover:text-brand-700 px-1"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeleting(row)}
                            title="ลบ"
                            className="text-slate-400 hover:text-rose-600 px-1"
                          >
                            🗑️
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

        {totalPages > 1 && (
          <div className="p-3 flex items-center justify-between border-t text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="text-slate-500">
              หน้า {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="font-semibold text-slate-700">
                {editing === "new" ? "เพิ่มรายการใหม่" : "แก้ไขรายการ"} — {def.label}
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={save} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {def.fields
                .filter((f) => !f.computed)
                .map((f) => {
                  const current =
                    editing === "new" ? "" : ((editing as Row)[f.key] as string | number | null);
                  const value =
                    current === null || current === undefined
                      ? ""
                      : f.type === "date"
                        ? String(current).slice(0, 10)
                        : String(current);

                  return (
                    <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        {f.label}
                        {f.required && " *"}
                      </label>

                      {f.type === "lookup" ? (
                        <select
                          name={f.key}
                          required={f.required}
                          defaultValue={value}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">-- เลือก --</option>
                          {(options[f.key] ?? []).map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "select" ? (
                        <select
                          name={f.key}
                          required={f.required}
                          defaultValue={value}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">-- เลือก --</option>
                          {(f.options ?? []).map((o) => (
                            <option key={o} value={o}>
                              {statusText(o)}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "textarea" ? (
                        <textarea
                          name={f.key}
                          required={f.required}
                          defaultValue={value}
                          rows={3}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          name={f.key}
                          type={f.type === "time" ? "time" : f.type}
                          step={f.type === "number" ? "any" : undefined}
                          required={f.required}
                          defaultValue={value}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        />
                      )}

                      {f.help && <p className="text-[11px] text-slate-400 mt-1">{f.help}</p>}
                    </div>
                  );
                })}

              <div className="sm:col-span-2 pt-2 flex gap-2 justify-end border-t mt-1">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg border text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ไฟล์แนบของรายการ */}
      {attaching && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttaching(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-4">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="font-semibold text-slate-700">
                ไฟล์แนบ — {def.label} #{attaching.id}
              </div>
              <button
                onClick={() => setAttaching(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5">
              <AttachmentBox refKey={def.key} recordId={attaching.id} />
            </div>
          </div>
        </div>
      )}

      {/* ยืนยันการลบ */}
      {deleting && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleting(null);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="font-semibold text-slate-700 mb-2">ยืนยันการลบรายการ</div>
            <p className="text-sm text-slate-500 mb-4">
              ต้องการลบรายการนี้ออกจาก{def.label}ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg border text-sm">
                ยกเลิก
              </button>
              <button
                onClick={remove}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
