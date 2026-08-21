"use client";

import { useCallback, useEffect, useState } from "react";

interface LedgerRow {
  code: string;
  generic_name: string;
  trade_name: string | null;
  unit: string | null;
  opening: string;
  received: string;
  issued: string;
  closing: string;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export default function StockLedger({ kind }: { kind: "drug" | "vaccine" }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/${kind}?view=ledger&year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const num = (v: string) => Number(v).toLocaleString("th-TH");
  const thaiYear = year + 543;

  return (
    <div className="space-y-3">
      <div className="no-print bg-white rounded-xl border p-3 flex flex-wrap items-center gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {THAI_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
            <option key={y} value={y}>
              พ.ศ. {y + 543}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => window.print()}
          className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50"
        >
          🖨 พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border p-5">
        <div className="text-center mb-5">
          <div className="font-bold text-slate-800">
            ทะเบียนรับ-จ่าย{kind === "drug" ? "ยา" : "วัคซีน"} (แบบ รบ.301)
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            ประจำเดือน {THAI_MONTHS[month - 1]} พ.ศ. {thaiYear}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="border px-3 py-2 text-left font-medium">รหัส</th>
                <th className="border px-3 py-2 text-left font-medium">รายการ</th>
                <th className="border px-3 py-2 text-center font-medium">หน่วย</th>
                <th className="border px-3 py-2 text-right font-medium">ยกมา</th>
                <th className="border px-3 py-2 text-right font-medium">รับ</th>
                <th className="border px-3 py-2 text-right font-medium">จ่าย</th>
                <th className="border px-3 py-2 text-right font-medium">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="border px-3 py-8 text-center text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border px-3 py-8 text-center text-slate-400">
                    ไม่มีรายการเคลื่อนไหวในเดือนนี้
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.code}>
                    <td className="border px-3 py-2 text-slate-500">{r.code}</td>
                    <td className="border px-3 py-2">{r.trade_name || r.generic_name}</td>
                    <td className="border px-3 py-2 text-center text-slate-500">{r.unit ?? "-"}</td>
                    <td className="border px-3 py-2 text-right">{num(r.opening)}</td>
                    <td className="border px-3 py-2 text-right text-emerald-700">{num(r.received)}</td>
                    <td className="border px-3 py-2 text-right text-sky-700">{num(r.issued)}</td>
                    <td className="border px-3 py-2 text-right font-semibold">{num(r.closing)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-10 text-sm text-slate-600">
          <div className="text-center">
            <div>(ลงชื่อ) ..................................................</div>
            <div className="mt-1">ผู้จัดทำ</div>
          </div>
          <div className="text-center">
            <div>(ลงชื่อ) ..................................................</div>
            <div className="mt-1">ผู้ตรวจสอบ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
