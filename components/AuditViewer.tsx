"use client";

import { useCallback, useEffect, useState } from "react";
import { MODULES } from "@/lib/modules";
import { ROLE_LABEL } from "@/lib/permissions";

interface AuditRow {
  id: number;
  username: string | null;
  full_name: string | null;
  role: string | null;
  module_key: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export default function AuditViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [moduleKey, setModuleKey] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pageSize = 50;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(moduleKey ? { module: moduleKey } : {}),
        ...(debounced ? { search: debounced } : {}),
      });
      const res = await fetch(`/api/audit?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, moduleKey, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center border-b">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาผู้ใช้ / การกระทำ / รายละเอียด..."
          className="border rounded-lg px-3 py-2 text-sm w-full sm:w-72"
        />
        <select
          value={moduleKey}
          onChange={(e) => {
            setModuleKey(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกระบบงาน</option>
          <option value="system">ระบบ (เข้า/ออก, ตั้งค่า)</option>
          {Object.values(MODULES).map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-slate-400">{total.toLocaleString("th-TH")} รายการ</span>
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
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">วันเวลา</th>
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ผู้ใช้งาน</th>
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">บทบาท</th>
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">ระบบงาน</th>
              <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">การกระทำ</th>
              <th className="text-left px-4 py-2.5 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-10">
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-10">
                  ไม่พบรายการ
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 text-xs">
                    {new Date(r.created_at).toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{r.full_name ?? "-"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 text-xs">
                    {r.role ? (ROLE_LABEL[r.role] ?? r.role) : "-"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {r.module_key === "system"
                      ? "ระบบ"
                      : r.module_key === "ai"
                        ? "ผู้ช่วยรายงาน"
                        : (MODULES[r.module_key ?? ""]?.shortLabel ?? r.module_key ?? "-")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{r.action}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.detail ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t flex items-center justify-between text-sm">
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
  );
}
