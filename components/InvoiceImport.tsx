"use client";

import { useEffect, useRef, useState } from "react";

interface MatchedLine {
  lineNo: number;
  code: string | null;
  name: string | null;
  lotNo: string | null;
  expiryDate: string | null;
  qty: number;
  unitPrice: number | null;
  itemId: number | null;
  matchedName: string | null;
  matchedBy: "code" | "name" | null;
  errors: string[];
}

interface Warehouse {
  id: number;
  name: string;
  is_main: boolean;
}

const EXAMPLE = `รหัส\tชื่อรายการ\tเลขที่ล็อต\tวันหมดอายุ\tจำนวน\tราคาต่อหน่วย
D001\tParacetamol 500 mg\tL2569A\t31/12/2570\t500\t0.50
D002\tAmoxicillin 500 mg\tL2569B\t2027-06-30\t200\t1.20`;

/**
 * นำเข้า Invoice / ใบส่งของจาก รพ.แม่ข่าย
 * ขั้นที่ 1 วางข้อมูล → ขั้นที่ 2 ตรวจผลการจับคู่ → ขั้นที่ 3 รับเข้าสต๊อก
 */
export default function InvoiceImport({ kind }: { kind: "drug" | "vaccine" }) {
  const label = kind === "drug" ? "ยา" : "วัคซีน";

  const [text, setText] = useState("");
  const [lines, setLines] = useState<MatchedLine[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ received: number; totalQty: number; created: number } | null>(
    null,
  );

  const [docNo, setDocNo] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceDest, setSourceDest] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/stock/${kind}/import`);
        const data = await res.json();
        if (res.ok) {
          setWarehouses(data.warehouses ?? []);
          setCanWrite(Boolean(data.canWrite));
          const main = (data.warehouses ?? []).find((w: Warehouse) => w.is_main);
          if (main) setWarehouseId(String(main.id));
        }
      } catch {
        /* ปล่อยให้ผู้ใช้เลือกคลังเองถ้าโหลดไม่ได้ */
      }
    })();
  }, [kind]);

  async function readFile(file: File) {
    const content = await file.text();
    setText(content);
    setLines(null);
    setDone(null);
  }

  async function send(mode: "preview" | "commit") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/${kind}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text,
          createMissing,
          doc_no: docNo,
          move_date: moveDate,
          source_dest: sourceDest,
          warehouse_id: warehouseId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.lines)) setLines(data.lines);
        throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      }

      if (mode === "preview") {
        setLines(data.lines);
        setDone(null);
      } else {
        setDone({ received: data.received, totalQty: data.totalQty, created: data.created ?? 0 });
        setLines(null);
        setText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  const ready = lines?.filter((l) => l.errors.length === 0).length ?? 0;
  const problems = lines?.filter((l) => l.errors.length > 0).length ?? 0;
  const unmatched = lines?.filter((l) => !l.itemId).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm rounded-xl px-4 py-3 leading-relaxed">
        คัดลอกตารางรายการ{label}จากไฟล์ Excel ของ รพ.แม่ข่ายมาวางในช่องด้านล่าง หรือเลือกไฟล์ CSV
        ระบบจะจับคู่กับทะเบียนคลังให้ก่อน แล้วจึงรับเข้าสต๊อกเป็นล็อตตามวันหมดอายุ
        <div className="mt-2 text-xs text-sky-800/80">
          ลำดับคอลัมน์: รหัส · ชื่อรายการ · เลขที่ล็อต · วันหมดอายุ · จำนวน · ราคาต่อหน่วย
          (วันที่รองรับทั้ง 31/12/2570 และ 2027-12-31)
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="shrink-0 underline">
            ปิด
          </button>
        </div>
      )}

      {done && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3">
          ✓ รับเข้าสต๊อกสำเร็จ {done.received} รายการ รวม {done.totalQty.toLocaleString("th-TH")} หน่วย
          {done.created > 0 && ` (สร้างรายการใหม่ในทะเบียน ${done.created} รายการ)`} — ตรวจดูได้ที่
          Stock Card และทะเบียนรับ-จ่าย
        </div>
      )}

      {/* ข้อมูลหัวใบส่งของ */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">เลขที่ใบส่งของ</label>
          <input
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
            placeholder="เช่น INV-2569/001"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">วันที่รับของ *</label>
          <input
            type="date"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">รับจาก</label>
          <input
            value={sourceDest}
            onChange={(e) => setSourceDest(e.target.value)}
            placeholder="ชื่อ รพ.แม่ข่าย"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">รับเข้าคลัง</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">-- ไม่ระบุคลัง --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.is_main ? " (คลังหลัก)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ช่องวางข้อมูล */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-semibold text-slate-700">
            รายการใน Invoice
            <span className="ml-2 text-xs font-normal text-slate-400">
              วางจาก Excel ได้โดยตรง
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setText(EXAMPLE)}
              className="text-xs px-2.5 py-1.5 rounded-lg border hover:bg-slate-50"
            >
              ใส่ตัวอย่าง
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs px-2.5 py-1.5 rounded-lg border hover:bg-slate-50"
            >
              เลือกไฟล์ CSV
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLines(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder="วางข้อมูลจาก Excel ที่นี่..."
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => send("preview")}
            disabled={busy || !text.trim()}
            className="text-sm px-4 py-2 rounded-lg border hover:bg-slate-50 disabled:opacity-40"
          >
            {busy ? "กำลังตรวจสอบ..." : "ตรวจสอบการจับคู่"}
          </button>
        </div>
      </div>

      {/* ผลการจับคู่ */}
      {lines && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="font-semibold text-slate-800">ผลการจับคู่</span>
              <span className="ml-2 text-emerald-700">พร้อมรับเข้า {ready} บรรทัด</span>
              {problems > 0 && <span className="ml-2 text-rose-600">มีปัญหา {problems} บรรทัด</span>}
            </div>
            {canWrite && (
              <div className="flex flex-wrap items-center gap-3">
                {unmatched > 0 && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={createMissing}
                      onChange={(e) => setCreateMissing(e.target.checked)}
                    />
                    สร้างรายการใหม่ในทะเบียนให้ {unmatched} รายการที่ยังไม่มี
                  </label>
                )}
                <button
                  onClick={() => send("commit")}
                  disabled={busy || ready === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40"
                >
                  {busy ? "กำลังรับเข้า..." : "รับเข้าสต๊อก"}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">รหัส / ชื่อใน Invoice</th>
                  <th className="text-left px-3 py-2 font-medium">จับคู่กับ</th>
                  <th className="text-left px-3 py-2 font-medium">ล็อต</th>
                  <th className="text-left px-3 py-2 font-medium">หมดอายุ</th>
                  <th className="text-right px-3 py-2 font-medium">จำนวน</th>
                  <th className="text-left px-3 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.lineNo}
                    className={`border-t ${l.errors.length > 0 ? "bg-rose-50/50" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-400">{l.lineNo}</td>
                    <td className="px-3 py-2">
                      <div className="text-slate-800">{l.name ?? l.code ?? "-"}</div>
                      {l.name && l.code && (
                        <div className="text-[11px] text-slate-400">{l.code}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.matchedName ? (
                        <span className="text-slate-700">
                          {l.matchedName}
                          <span className="text-[11px] text-slate-400 ml-1">
                            ({l.matchedBy === "code" ? "ตามรหัส" : "ตามชื่อ"})
                          </span>
                        </span>
                      ) : (
                        <span className="text-rose-600 text-xs">ยังไม่มีในทะเบียน</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.lotNo ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{l.expiryDate ?? "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.qty.toLocaleString("th-TH")}
                    </td>
                    <td className="px-3 py-2">
                      {l.errors.length === 0 ? (
                        <span className="text-emerald-600 text-xs">พร้อมรับเข้า</span>
                      ) : (
                        <span className="text-rose-600 text-xs">{l.errors.join(" · ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
