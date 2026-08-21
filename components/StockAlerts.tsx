"use client";

import { useEffect, useState } from "react";

interface AlertData {
  belowMin: {
    id: number;
    code: string;
    generic_name: string;
    trade_name: string | null;
    unit: string | null;
    balance: number;
    min_qty: number;
  }[];
  expiringLots: {
    item_id: number;
    code: string;
    generic_name: string;
    lot_no: string | null;
    expiry_date: string | null;
    qty: number;
    unit: string | null;
    days_to_expiry: number | null;
    expired: boolean;
  }[];
}

export default function StockAlerts({ kind }: { kind: "drug" | "vaccine" }) {
  const [data, setData] = useState<AlertData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/stock/${kind}?view=alerts`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [kind]);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">{error}</div>
    );
  }
  if (!data) return <div className="text-sm text-slate-400">กำลังโหลด...</div>;

  const expired = data.expiringLots.filter((l) => l.expired);
  const soon = data.expiringLots.filter((l) => !l.expired);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard tone="rose" value={expired.length} label="ล็อตที่หมดอายุแล้ว" />
        <SummaryCard tone="amber" value={soon.length} label="ล็อตใกล้หมดอายุ (ภายใน 90 วัน)" />
        <SummaryCard tone="sky" value={data.belowMin.length} label="รายการต่ำกว่าจุดสั่งซื้อ" />
      </div>

      <Section
        title="⛔ ล็อตที่หมดอายุแล้ว — ต้องตัดออกจากคลัง"
        empty="ไม่มีล็อตที่หมดอายุ"
        rows={expired}
        tone="rose"
      />

      <Section
        title="⚠️ ล็อตใกล้หมดอายุภายใน 90 วัน — ควรเร่งใช้ก่อน"
        empty="ไม่มีล็อตที่ใกล้หมดอายุ"
        rows={soon}
        tone="amber"
      />

      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b font-semibold text-sm text-slate-700">
          📉 รายการที่คงเหลือต่ำกว่าจุดสั่งซื้อขั้นต่ำ
        </div>
        {data.belowMin.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            ทุกรายการมียอดคงเหลือเพียงพอ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">รหัส</th>
                  <th className="text-left px-4 py-2 font-medium">รายการ</th>
                  <th className="text-right px-4 py-2 font-medium">คงเหลือ</th>
                  <th className="text-right px-4 py-2 font-medium">จุดสั่งซื้อขั้นต่ำ</th>
                  <th className="text-right px-4 py-2 font-medium">ต้องสั่งเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {data.belowMin.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-2.5 text-slate-500">{b.code}</td>
                    <td className="px-4 py-2.5">{b.trade_name || b.generic_name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700">
                      {b.balance.toLocaleString("th-TH")} {b.unit ?? ""}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {b.min_qty.toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {Math.max(0, b.min_qty - b.balance).toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  tone,
  value,
  label,
}: {
  tone: "rose" | "amber" | "sky";
  value: number;
  label: string;
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5">{label}</div>
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  tone: "rose" | "amber";
  rows: AlertData["expiringLots"];
}) {
  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b font-semibold text-sm text-slate-700">{title}</div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">รหัส</th>
                <th className="text-left px-4 py-2 font-medium">รายการ</th>
                <th className="text-left px-4 py-2 font-medium">เลขที่ผลิต</th>
                <th className="text-left px-4 py-2 font-medium">วันหมดอายุ</th>
                <th className="text-right px-4 py-2 font-medium">คงเหลือ</th>
                <th className="text-right px-4 py-2 font-medium">เหลืออีก</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={`${l.item_id}-${l.lot_no}-${i}`} className="border-t">
                  <td className="px-4 py-2.5 text-slate-500">{l.code}</td>
                  <td className="px-4 py-2.5">{l.generic_name}</td>
                  <td className="px-4 py-2.5">{l.lot_no ?? "-"}</td>
                  <td className="px-4 py-2.5">{thaiDate(l.expiry_date)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {l.qty.toLocaleString("th-TH")} {l.unit ?? ""}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      tone === "rose" ? "text-rose-600" : "text-amber-600"
                    }`}
                  >
                    {l.days_to_expiry !== null
                      ? l.days_to_expiry <= 0
                        ? `หมดอายุแล้ว ${Math.abs(l.days_to_expiry)} วัน`
                        : `${l.days_to_expiry} วัน`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
