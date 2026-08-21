"use client";

import { useCallback, useEffect, useState } from "react";

interface ReqHeader {
  id: number;
  kind: string;
  doc_no: string | null;
  req_date: string;
  requester: string | null;
  purpose: string | null;
  status: string;
  approver_name: string | null;
  issuer_name: string | null;
  receiver_name: string | null;
  note: string | null;
}

interface ReqItem {
  id: number;
  item_id: number;
  qty_requested: string | number;
  qty_issued: string | number | null;
  note: string | null;
  code?: string;
  item_name?: string;
  unit?: string;
  balance?: number;
}

interface CatalogItem {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  balance: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  issued: "จ่ายของแล้ว",
  rejected: "ไม่อนุมัติ",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-sky-100 text-sky-700",
  issued: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export default function RequisitionDetail({ id, kind }: { id: number; kind: "drug" | "vaccine" }) {
  const [header, setHeader] = useState<ReqHeader | null>(null);
  const [items, setItems] = useState<ReqItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [newItemId, setNewItemId] = useState("");
  const [newQty, setNewQty] = useState("");

  const label = kind === "vaccine" ? "วัคซีน" : "ยา";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/requisition/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อ่านข้อมูลไม่สำเร็จ");
      setHeader(data.requisition);
      setItems(data.items);
      setCatalog(data.catalog);
      setCanWrite(data.canWrite);
      setCanApprove(data.canApprove);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function act(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/requisition/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      notify(successMsg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="bg-white rounded-xl border p-8 text-center text-slate-400">กำลังโหลด...</div>;
  }
  if (!header) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
        {error || "ไม่พบใบเบิก"}
      </div>
    );
  }

  const locked = header.status === "issued" || header.status === "rejected";
  const editable = canWrite && !locked;
  const totalQty = items.reduce((s, it) => s + Number(it.qty_requested), 0);
  const hasShortage = items.some((it) => Number(it.qty_requested) > Number(it.balance ?? 0));

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
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

      {/* หัวใบเบิก */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm text-slate-500">ใบเบิก{label}</div>
            <div className="text-lg font-bold text-slate-800">
              เลขที่ {header.doc_no || `#${header.id}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_TONE[header.status] ?? "bg-slate-100 text-slate-700"}`}
            >
              {STATUS_LABEL[header.status] ?? header.status}
            </span>
            <a
              href={`/print/requisition/${header.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-slate-50"
            >
              🖨 พิมพ์ใบเบิก
            </a>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">วันที่เบิก</dt>
            <dd>{new Date(header.req_date).toLocaleDateString("th-TH")}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ผู้เบิก</dt>
            <dd>{header.requester || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ผู้อนุมัติ</dt>
            <dd>{header.approver_name || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ผู้จ่าย</dt>
            <dd>{header.issuer_name || "-"}</dd>
          </div>
        </dl>
      </div>

      {/* รายการในใบเบิก */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-slate-700 text-sm">
            รายการ{label}ในใบเบิก ({items.length} รายการ)
          </div>
          <div className="text-xs text-slate-400">รวม {totalQty.toLocaleString("th-TH")} หน่วย</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">รหัส</th>
                <th className="text-left px-4 py-2 font-medium">รายการ</th>
                <th className="text-right px-4 py-2 font-medium">คงเหลือ</th>
                <th className="text-right px-4 py-2 font-medium">ขอเบิก</th>
                <th className="text-right px-4 py-2 font-medium">จ่ายจริง</th>
                {editable && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-8">
                    ยังไม่มีรายการในใบเบิก — เพิ่มรายการด้านล่าง
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const want = Number(it.qty_requested);
                  const have = Number(it.balance ?? 0);
                  const short = want > have;
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-4 py-2.5 whitespace-nowrap">{it.code}</td>
                      <td className="px-4 py-2.5">{it.item_name}</td>
                      <td
                        className={`px-4 py-2.5 text-right whitespace-nowrap ${short ? "text-rose-600 font-medium" : ""}`}
                      >
                        {have.toLocaleString("th-TH")} {it.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {want.toLocaleString("th-TH")}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {it.qty_issued === null || it.qty_issued === undefined
                          ? "-"
                          : Number(it.qty_issued).toLocaleString("th-TH")}
                      </td>
                      {editable && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            disabled={busy}
                            onClick={() =>
                              act({ action: "delete-item", itemRowId: it.id }, "ลบรายการแล้ว")
                            }
                            className="text-slate-400 hover:text-rose-600 px-1"
                            title="ลบรายการ"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="p-3 border-t bg-slate-50 flex flex-col sm:flex-row gap-2">
            <select
              value={newItemId}
              onChange={(e) => setNewItemId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm flex-1 bg-white"
            >
              <option value="">-- เลือก{label}ที่ต้องการเบิก --</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} (คงเหลือ {c.balance.toLocaleString("th-TH")} {c.unit ?? ""})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="any"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="จำนวน"
              className="border rounded-lg px-3 py-2 text-sm w-full sm:w-32"
            />
            <button
              disabled={busy || !newItemId || !newQty}
              onClick={async () => {
                await act(
                  { action: "add-item", itemId: Number(newItemId), qty: Number(newQty) },
                  "เพิ่มรายการแล้ว",
                );
                setNewItemId("");
                setNewQty("");
              }}
              className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm hover:bg-brand-800 disabled:opacity-40 whitespace-nowrap"
            >
              + เพิ่มรายการ
            </button>
          </div>
        )}
      </div>

      {/* สายอนุมัติ */}
      <div className="bg-white rounded-xl border p-4">
        <div className="font-semibold text-slate-700 text-sm mb-3">ขั้นตอนดำเนินการ</div>

        {hasShortage && header.status !== "issued" && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2 mb-3">
            มีรายการที่ยอดคงเหลือไม่พอ — ต้องรับ{label}เข้าคลังเพิ่มก่อนจึงจะจ่ายของได้
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canApprove && header.status === "pending" && (
            <>
              <button
                disabled={busy || items.length === 0}
                onClick={() => act({ action: "approve" }, "อนุมัติใบเบิกแล้ว")}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700 disabled:opacity-40"
              >
                ✓ อนุมัติใบเบิก
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = prompt("เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)") ?? "";
                  act({ action: "reject", reason }, "บันทึกไม่อนุมัติแล้ว");
                }}
                className="px-4 py-2 rounded-lg border border-rose-300 text-rose-600 text-sm hover:bg-rose-50 disabled:opacity-40"
              >
                ✕ ไม่อนุมัติ
              </button>
            </>
          )}

          {canWrite && header.status === "approved" && (
            <button
              disabled={busy || hasShortage}
              onClick={() => {
                const receiver = prompt("ชื่อผู้รับของ") ?? "";
                act({ action: "issue", receiverName: receiver }, "จ่ายของและตัดสต๊อกเรียบร้อย");
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-40"
            >
              📦 จ่ายของ (ตัดสต๊อกจริง)
            </button>
          )}

          {header.status === "issued" && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              จ่ายของเรียบร้อยแล้ว — ระบบตัดสต๊อกแบบ FEFO (หมดอายุก่อนจ่ายก่อน) และบันทึกลง Stock
              Card ให้อัตโนมัติ
            </div>
          )}

          {header.status === "rejected" && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              ใบเบิกนี้ไม่ได้รับอนุมัติ
            </div>
          )}

          {header.status === "pending" && !canApprove && (
            <div className="text-sm text-slate-500">
              ใบเบิกอยู่ระหว่างรออนุมัติจากผู้มีอำนาจ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
