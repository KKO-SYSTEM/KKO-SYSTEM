"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_FILE_BYTES, fileIcon, formatBytes } from "@/lib/attachments";

interface FileRow {
  id: number;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

/**
 * กล่องจัดการไฟล์แนบของรายการหนึ่งรายการ
 * ใช้ร่วมกันได้ทุกทะเบียน โดยส่ง refKey ("personnel" หรือ "vhv/meeting") กับเลขที่รายการเข้ามา
 */
export default function AttachmentBox({
  refKey,
  recordId,
  title,
}: {
  refKey: string;
  recordId: number;
  title?: string;
}) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ refKey, recordId: String(recordId) });
      const res = await fetch(`/api/attachment?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อ่านรายการไฟล์แนบไม่สำเร็จ");
      setRows(data.rows ?? []);
      setCanWrite(Boolean(data.canWrite));
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [refKey, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" ใหญ่เกิน ${formatBytes(MAX_FILE_BYTES)}`);
        continue;
      }
      const form = new FormData();
      form.append("refKey", refKey);
      form.append("recordId", String(recordId));
      form.append("file", file);
      try {
        const res = await fetch("/api/attachment", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      } catch (e) {
        setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
    load();
  }

  async function remove(id: number, name: string) {
    if (!window.confirm(`ต้องการลบไฟล์ "${name}" ใช่หรือไม่?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attachment/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {title && <div className="text-sm font-semibold text-slate-700">{title}</div>}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-4 text-center">กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center border border-dashed rounded-lg">
          ยังไม่มีไฟล์แนบ
        </div>
      ) : (
        <ul className="divide-y border rounded-lg">
          {rows.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-lg shrink-0">{fileIcon(f.file_name)}</span>
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/attachment/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-700 hover:underline block truncate"
                >
                  {f.file_name}
                </a>
                <div className="text-[11px] text-slate-400">
                  {formatBytes(Number(f.size_bytes ?? 0))}
                  {f.uploaded_by && ` · ${f.uploaded_by}`}
                  {" · "}
                  {new Date(f.uploaded_at).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              {canWrite && (
                <button
                  onClick={() => remove(f.id, f.file_name)}
                  disabled={busy}
                  title="ลบไฟล์นี้"
                  className="shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-40"
                >
                  🗑️
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => upload(e.target.files)}
            className="block w-full text-sm text-slate-500
              file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-sm file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100
              disabled:opacity-50"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            รองรับ Word · Excel · PowerPoint · PDF · รูปภาพ · zip — ไม่เกินไฟล์ละ{" "}
            {formatBytes(MAX_FILE_BYTES)}
            {busy && " · กำลังอัปโหลด..."}
          </p>
        </div>
      )}
    </div>
  );
}
