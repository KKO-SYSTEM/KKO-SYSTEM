"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldDef, ModuleDef } from "@/lib/modules";
import { STATUS_TONE } from "@/lib/modules";
import AttachmentBox from "./AttachmentBox";

interface Row extends Record<string, unknown> {
  id: number;
}

export default function RecordManager({ mod }: { mod: ModuleDef }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [toast, setToast] = useState("");
  const [attaching, setAttaching] = useState<Row | null>(null);

  const pageSize = 25;
  const tableFields = mod.fields.filter((f) => !f.hideInTable);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(debounced ? { search: debounced } : {}),
      });
      const res = await fetch(`/api/records/${mod.key}?${qs}`);
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
  }, [mod.key, page, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b">
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="border rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
              {total.toLocaleString("th-TH")} รายการ
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/export/${mod.key}${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`}
              className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50 transition"
            >
              ⬇ Excel/CSV
            </a>
            <button
              onClick={() => window.print()}
              className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50 transition"
            >
              🖨 พิมพ์
            </button>
            {canWrite && (
              <button
                onClick={() => setEditing("new")}
                className="text-sm px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition"
              >
                + เพิ่มรายการ
              </button>
            )}
          </div>
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
                {tableFields.map((f) => (
                  <th key={f.key} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 w-28" />
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
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    {tableFields.map((f) => (
                      <td key={f.key} className="px-4 py-2.5 whitespace-nowrap">
                        <CellValue field={f} value={row[f.key]} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap no-print">
                      <button
                        onClick={() => setAttaching(row)}
                        className="text-slate-400 hover:text-brand-700 px-1"
                        title="ไฟล์แนบ"
                      >
                        📎
                      </button>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => setEditing(row)}
                            className="text-slate-400 hover:text-brand-700 px-1"
                            title="แก้ไข"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeleting(row)}
                            className="text-slate-400 hover:text-rose-600 px-1"
                            title="ลบ"
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
          <div className="p-3 border-t flex items-center justify-between text-sm no-print">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-slate-50"
            >
              ← ก่อนหน้า
            </button>
            <span className="text-slate-500">
              หน้า {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-slate-50"
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>

      {editing && (
        <RecordForm
          mod={mod}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notify(msg);
            load();
          }}
        />
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
                ไฟล์แนบ — {mod.label} #{attaching.id}
              </div>
              <button
                onClick={() => setAttaching(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-5">
              <AttachmentBox refKey={mod.key} recordId={attaching.id} />
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDelete
          mod={mod}
          record={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            notify("ลบรายการเรียบร้อยแล้ว");
            load();
          }}
        />
      )}
    </div>
  );
}

function CellValue({ field, value }: { field: FieldDef; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-300">-</span>;
  }

  if (field.type === "date") {
    const d = new Date(String(value));
    return (
      <span>
        {isNaN(d.getTime())
          ? String(value)
          : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    );
  }

  if (field.type === "number") {
    return <span>{Number(value).toLocaleString("th-TH")}</span>;
  }

  if (field.badge) {
    const tone = STATUS_TONE[String(value)] ?? "neutral";
    const cls =
      tone === "good"
        ? "bg-emerald-100 text-emerald-700"
        : tone === "warn"
          ? "bg-amber-100 text-amber-700"
          : tone === "bad"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-700";
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{String(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

function RecordForm({
  mod,
  record,
  onClose,
  onSaved,
}: {
  mod: ModuleDef;
  record: Row | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of mod.fields) {
      const v = record?.[f.key];
      if (v === null || v === undefined) {
        init[f.key] = "";
      } else if (f.type === "date") {
        const d = new Date(String(v));
        init[f.key] = isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
      } else {
        init[f.key] = String(v);
      }
    }
    return init;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const editableFields = mod.fields.filter((f) => !f.computed);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = record ? `/api/records/${mod.key}/${record.id}` : `/api/records/${mod.key}`;
      const res = await fetch(url, {
        method: record ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setBusy(false);
        return;
      }
      onSaved(record ? "แก้ไขรายการเรียบร้อยแล้ว" : "เพิ่มรายการเรียบร้อยแล้ว");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div className="font-semibold text-slate-800">
            {record ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"} — {mod.label}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editableFields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                </label>

                {f.type === "select" ? (
                  <select
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    required={f.required}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">-- เลือก --</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    required={f.required}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    required={f.required}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}

                {f.help && <p className="text-[11px] text-slate-400 mt-1">{f.help}</p>}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
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
            {busy ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  mod,
  record,
  onClose,
  onDeleted,
}: {
  mod: ModuleDef;
  record: Row;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const label = (() => {
    const parts = ["first_name", "last_name"]
      .filter((k) => mod.fields.some((f) => f.key === k))
      .map((k) => record[k])
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
    const f = mod.fields.find((x) => x.type === "text" && x.required) ?? mod.fields[0];
    return String(record[f.key] ?? `#${record.id}`);
  })();

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/records/${mod.key}/${record.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ลบไม่สำเร็จ");
        setBusy(false);
        return;
      }
      onDeleted();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="font-semibold text-slate-800 mb-2">ยืนยันการลบรายการ</div>
        <p className="text-sm text-slate-500 mb-4">
          ต้องการลบ &ldquo;{label}&rdquo; ออกจาก{mod.label}ใช่หรือไม่?
          <br />
          <span className="text-xs text-slate-400">การลบไม่สามารถย้อนกลับได้</span>
        </p>
        {error && (
          <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-50">
            ยกเลิก
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "กำลังลบ..." : "ลบรายการ"}
          </button>
        </div>
      </div>
    </div>
  );
}
