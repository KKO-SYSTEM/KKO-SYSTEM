"use client";

import { useCallback, useEffect, useState } from "react";

interface Balance {
  id: number;
  code: string;
  generic_name: string;
  trade_name: string | null;
  unit: string | null;
  min_qty: number;
  balance: number;
  nearest_expiry: string | null;
  days_to_expiry: number | null;
  lot_count: number;
  below_min: boolean;
  expiring_soon: boolean;
  expired: boolean;
}

interface Movement {
  id: number;
  move_date: string;
  doc_no: string | null;
  move_type: string;
  lot_no: string | null;
  expiry_date: string | null;
  qty_in: string;
  qty_out: string;
  balance_after: string | null;
  source_dest: string | null;
  note: string | null;
  created_by: string | null;
}

interface Lot {
  id: number;
  lot_no: string | null;
  expiry_date: string | null;
  qty: string;
  warehouse_name: string | null;
}

export default function StockCard({ kind }: { kind: "drug" | "vaccine" }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [card, setCard] = useState<{ item: Balance; movements: Movement[]; lots: Lot[] } | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMove, setShowMove] = useState(false);
  const [toast, setToast] = useState("");

  const loadBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/${kind}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBalances(data.rows);
      setCanWrite(data.canWrite);
      if (data.rows.length && selected === null) setSelected(data.rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, selected]);

  const loadCard = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/stock/${kind}/card?itemId=${selected}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่าน Stock Card ไม่สำเร็จ");
    }
  }, [kind, selected]);

  useEffect(() => {
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  }

  const item = balances.find((b) => b.id === selected);

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* รายการทั้งหมด */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-sm text-slate-700">
            รายการทั้งหมด ({balances.length})
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-400">กำลังโหลด...</div>
            ) : (
              balances.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  className={`w-full text-left px-4 py-2.5 border-b hover:bg-slate-50 transition
                    ${selected === b.id ? "bg-brand-50 border-l-2 border-l-brand-600" : ""}`}
                >
                  <div className="text-sm font-medium text-slate-700 truncate">
                    {b.trade_name || b.generic_name}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] text-slate-400">{b.code}</span>
                    <span
                      className={`text-xs font-semibold ${
                        b.expired
                          ? "text-rose-600"
                          : b.below_min
                            ? "text-amber-600"
                            : "text-slate-600"
                      }`}
                    >
                      {b.balance.toLocaleString("th-TH")} {b.unit ?? ""}
                    </span>
                  </div>
                  {(b.below_min || b.expiring_soon || b.expired) && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {b.below_min && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                          ต่ำกว่าเกณฑ์
                        </span>
                      )}
                      {b.expired && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 rounded px-1.5 py-0.5">
                          มีล็อตหมดอายุ
                        </span>
                      )}
                      {!b.expired && b.expiring_soon && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">
                          ใกล้หมดอายุ
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Stock Card */}
        <div className="lg:col-span-3 space-y-4">
          {item && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {item.trade_name || item.generic_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    รหัส {item.code} · {item.generic_name}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">
                      {item.balance.toLocaleString("th-TH")}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      คงเหลือ ({item.unit ?? "หน่วย"})
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => setShowMove(true)}
                      className="text-sm px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                    >
                      + บันทึกรับ/จ่าย
                    </button>
                  )}
                </div>
              </div>

              {card && card.lots.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-xs font-medium text-slate-500 mb-2">
                    ล็อตคงเหลือ (เรียงตาม FEFO — จ่ายล็อตที่หมดอายุก่อน)
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {card.lots.map((l, i) => (
                      <div
                        key={l.id}
                        className={`text-xs rounded-lg border px-2.5 py-1.5 ${
                          i === 0 ? "border-brand-400 bg-brand-50" : "border-slate-200"
                        }`}
                      >
                        <span className="font-medium">{l.lot_no ?? "ไม่ระบุล็อต"}</span>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span>หมดอายุ {thaiDate(l.expiry_date)}</span>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="font-semibold">{Number(l.qty).toLocaleString("th-TH")}</span>
                        {i === 0 && <span className="ml-1.5 text-brand-600">← จ่ายก่อน</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-sm text-slate-700">
                Stock Card — ทะเบียนรับ-จ่าย
              </div>
              <button
                onClick={() => window.print()}
                className="no-print text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                🖨 พิมพ์
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">วันที่</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">เลขที่เอกสาร</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">รายการ</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">เลขที่ผลิต</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">วันหมดอายุ</th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">รับ</th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">จ่าย</th>
                    <th className="text-right px-3 py-2 font-medium whitespace-nowrap">คงเหลือ</th>
                    <th className="text-left px-3 py-2 font-medium whitespace-nowrap">ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {!card ? (
                    <tr>
                      <td colSpan={9} className="text-center text-slate-400 py-10">
                        เลือกรายการทางซ้ายเพื่อดู Stock Card
                      </td>
                    </tr>
                  ) : card.movements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-slate-400 py-10">
                        ยังไม่มีรายการเคลื่อนไหว
                      </td>
                    </tr>
                  ) : (
                    card.movements.map((m) => (
                      <tr key={m.id} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap">{thaiDate(m.move_date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                          {m.doc_no ?? "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`text-xs rounded px-1.5 py-0.5 ${
                              Number(m.qty_in) > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {m.move_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{m.lot_no ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{thaiDate(m.expiry_date)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700">
                          {Number(m.qty_in) > 0 ? Number(m.qty_in).toLocaleString("th-TH") : ""}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-sky-700">
                          {Number(m.qty_out) > 0 ? Number(m.qty_out).toLocaleString("th-TH") : ""}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                          {m.balance_after !== null
                            ? Number(m.balance_after).toLocaleString("th-TH")
                            : "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-400 text-xs">
                          {m.created_by ?? "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showMove && item && (
        <MovementForm
          kind={kind}
          item={item}
          onClose={() => setShowMove(false)}
          onSaved={(msg) => {
            setShowMove(false);
            notify(msg);
            loadBalances();
            loadCard();
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
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function MovementForm({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: string;
  item: Balance;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    move_type: "รับเข้า",
    move_date: new Date().toISOString().slice(0, 10),
    qty: "",
    doc_no: "",
    lot_no: "",
    expiry_date: "",
    source_dest: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isIn = form.move_type === "รับเข้า";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/${kind}/movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, item_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setBusy(false);
        return;
      }
      const lotInfo = data.usedLots?.length
        ? ` (ตัดล็อต ${data.usedLots.map((l: { lotNo: string; qty: number }) => `${l.lotNo ?? "-"}×${l.qty}`).join(", ")})`
        : "";
      onSaved(`บันทึก${form.move_type}เรียบร้อย — คงเหลือ ${data.balance}${lotInfo}`);
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div className="font-semibold text-slate-800 truncate">
            บันทึกรับ/จ่าย — {item.trade_name || item.generic_name}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">ประเภทรายการ</label>
              <select
                value={form.move_type}
                onChange={(e) => set("move_type", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="รับเข้า">รับเข้า</option>
                <option value="จ่ายออก">จ่ายออก</option>
                <option value="ตัดหมดอายุ">ตัดหมดอายุ</option>
                <option value="ชำรุด">ชำรุด/เสียหาย</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">วันที่</label>
              <input
                type="date"
                value={form.move_date}
                onChange={(e) => set("move_date", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                จำนวน ({item.unit ?? "หน่วย"}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={form.qty}
                onChange={(e) => set("qty", e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">เลขที่เอกสาร/ใบเบิก</label>
              <input
                value={form.doc_no}
                onChange={(e) => set("doc_no", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {isIn ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">เลขที่ผลิต (Lot)</label>
                <input
                  value={form.lot_no}
                  onChange={(e) => set("lot_no", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  วันหมดอายุ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => set("expiry_date", e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 text-xs text-brand-700">
              ระบบจะตัดยอดจากล็อตที่หมดอายุก่อนให้อัตโนมัติตามหลัก FEFO — คงเหลือปัจจุบัน{" "}
              <strong>{item.balance.toLocaleString("th-TH")}</strong> {item.unit ?? ""}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {isIn ? "รับจาก (แหล่งที่มา)" : "จ่ายให้ (ปลายทาง)"}
            </label>
            <input
              value={form.source_dest}
              onChange={(e) => set("source_dest", e.target.value)}
              placeholder={isIn ? "เช่น รพ.แม่ข่าย" : "เช่น ห้องจ่ายยา / หน่วยบริการ"}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">หมายเหตุ</label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

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
            {busy ? "กำลังบันทึก..." : "บันทึกรายการ"}
          </button>
        </div>
      </div>
    </div>
  );
}
