"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface DashboardData {
  cards: {
    drugExpiring: number;
    vaccineExpiring: number;
    pendingRequests: number;
    onLeaveToday: number;
  };
  trend: { label: string; value: number }[];
  byType: { label: string; value: number }[];
  pending: { label: string; count: number; href: string }[];
  news: { id: number; title: string; publish_date: string | null }[];
}

const DONUT_COLORS = ["#1F7A6C", "#2F9E8F", "#7FD2C2", "#AEE5D9", "#D5F2EB"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "อ่านข้อมูลไม่สำเร็จ");
        return json;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-4">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-400">กำลังโหลดข้อมูล...</div>;
  }

  const total = data.byType.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="💊"
          tone="amber"
          value={data.cards.drugExpiring}
          label="ยาใกล้หมดอายุ"
          unit="รายการ"
          href="/m/pharmacy/alerts"
        />
        <StatCard
          icon="💉"
          tone="rose"
          value={data.cards.vaccineExpiring}
          label="วัคซีนใกล้หมดอายุ"
          unit="รายการ"
          href="/m/vaccine/alerts"
        />
        <StatCard
          icon="🧾"
          tone="sky"
          value={data.cards.pendingRequests}
          label="ใบเบิก/ใบลารออนุมัติ"
          unit="รายการ"
        />
        <StatCard
          icon="🧑‍⚕️"
          tone="emerald"
          value={data.cards.onLeaveToday}
          label="เจ้าหน้าที่ลาวันนี้"
          unit="คน"
          href="/m/personnel/leave"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <div className="font-semibold text-slate-700 mb-3 text-sm">
            จำนวนผู้รับบริการ (รายเดือน)
          </div>
          {data.trend.length ? (
            <LineChart data={data.trend} />
          ) : (
            <EmptyChart text="ยังไม่มีข้อมูลสถิติผู้รับบริการ" />
          )}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="font-semibold text-slate-700 mb-3 text-sm">สถิติการให้บริการ</div>
          {data.byType.length ? (
            <>
              <DonutChart data={data.byType} />
              <div className="text-center text-2xl font-bold text-slate-800 mt-3">
                {total.toLocaleString("th-TH")}
              </div>
              <div className="text-center text-xs text-slate-400">รวมทั้งหมด (ราย)</div>
            </>
          ) : (
            <EmptyChart text="ยังไม่มีข้อมูล" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="font-semibold text-slate-700 mb-3 text-sm">งานค้างที่ต้องติดตาม</div>
          {data.pending.length ? (
            <ul className="space-y-1.5">
              {data.pending.map((p) => (
                <li key={p.label}>
                  <Link
                    href={p.href}
                    className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                  >
                    <span className="text-slate-600 truncate">{p.label}</span>
                    <span className="shrink-0 bg-amber-100 text-amber-700 font-medium rounded-full px-2.5 py-0.5 text-xs">
                      {p.count} รายการ
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400 py-6 text-center">
              ไม่มีงานค้าง — เยี่ยมมากครับ
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="font-semibold text-slate-700 mb-3 text-sm">ข่าวประชาสัมพันธ์</div>
          {data.news.length ? (
            <ul className="space-y-1.5">
              {data.news.map((n) => (
                <li key={n.id} className="flex gap-3 text-sm px-3 py-2">
                  <span className="text-slate-400 text-xs shrink-0 w-24">
                    {n.publish_date ? formatThaiDate(n.publish_date) : "-"}
                  </span>
                  <span className="text-slate-600 truncate">{n.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400 py-6 text-center">ยังไม่มีข่าวประชาสัมพันธ์</div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatThaiDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function StatCard({
  icon,
  tone,
  value,
  label,
  unit,
  href,
}: {
  icon: string;
  tone: "emerald" | "amber" | "rose" | "sky";
  value: number;
  label: string;
  unit: string;
  href?: string;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
  };

  const body = (
    <div className="bg-white rounded-xl border p-4 h-full hover:border-brand-300 transition">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-2 ${tones[tone]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value.toLocaleString("th-TH")}</div>
      <div className="text-xs text-slate-500 mt-0.5">
        {label} <span className="text-slate-400">({unit})</span>
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function EmptyChart({ text }: { text: string }) {
  return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{text}</div>;
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "ผู้รับบริการ",
            data: data.map((d) => d.value),
            borderColor: "#1F7A6C",
            backgroundColor: "rgba(31,122,108,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="h-56">
      <canvas ref={ref} />
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: "doughnut",
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            data: data.map((d) => d.value),
            backgroundColor: data.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="h-48">
      <canvas ref={ref} />
    </div>
  );
}
