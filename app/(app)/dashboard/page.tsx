"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

interface PcuCategory {
  no: number;
  name: string;
  full: number;
  score: number;
  pct: number;
  passPct: number;
  passed: boolean;
}

interface ExpiringItem {
  name: string;
  code: string;
  lotNo: string | null;
  expiryDate: string;
  qty: number;
  unit: string | null;
  kind: string;
  daysLeft: number;
}

interface DashboardData {
  cards: { activeStaff: number; pendingDocs: number; expiring90: number; lowStock: number };
  trend: { label: string; value: number }[];
  diseases: { label: string; value: number }[];
  budget: { fiscalYear: number | null; total: number; spent: number; projects: number };
  pcu: PcuCategory[];
  pcuAssessed: boolean;
  expiringList: ExpiringItem[];
  pending: { label: string; count: number; href: string }[];
  news: { id: number; title: string; publish_date: string | null }[];
  activity: { full_name: string | null; action: string; detail: string | null; created_at: string }[];
}

const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const nf = (n: number) => n.toLocaleString("th-TH");
const money = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

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
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-28 animate-pulse bg-slate-100/60" />
          ))}
        </div>
        <div className="card h-72 animate-pulse bg-slate-100/60" />
      </div>
    );
  }

  const remaining = data.budget.total - data.budget.spent;
  const spentPct = data.budget.total > 0 ? (data.budget.spent / data.budget.total) * 100 : 0;

  return (
    <div className="space-y-4 fade-up">
      {/* ═══ การ์ดสรุป ═══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon="🧑‍⚕️"
          label="เจ้าหน้าที่ปฏิบัติงาน"
          value={data.cards.activeStaff}
          unit="คน"
          href="/m/personnel"
          tone="neutral"
        />
        <StatTile
          icon="📋"
          label="เอกสารรออนุมัติ"
          value={data.cards.pendingDocs}
          unit="ฉบับ"
          href="/m/personnel/leave"
          tone={data.cards.pendingDocs > 0 ? "warn" : "neutral"}
          note="ใบลา · ใบเบิก · ขอใช้รถ"
        />
        <StatTile
          icon="⏳"
          label="ใกล้หมดอายุ (90 วัน)"
          value={data.cards.expiring90}
          unit="รายการ"
          href="/m/pharmacy/alerts"
          tone={data.cards.expiring90 > 0 ? "serious" : "good"}
        />
        <StatTile
          icon="📉"
          label="ต่ำกว่าจุดสั่งซื้อ"
          value={data.cards.lowStock}
          unit="รายการ"
          href="/m/pharmacy/alerts"
          tone={data.cards.lowStock > 0 ? "critical" : "good"}
        />
      </section>

      {/* ═══ กราฟผู้รับบริการ + งบประมาณ ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-4">
          <header className="mb-1">
            <h2 className="font-semibold text-slate-800">จำนวนผู้รับบริการรายเดือน</h2>
            <p className="text-xs text-slate-500">
              รวมทุกประเภทบริการ จากข้อมูลที่บันทึกในระบบ
            </p>
          </header>
          {data.trend.length === 0 ? (
            <EmptyBox text="ยังไม่มีข้อมูลสถิติผู้รับบริการ" />
          ) : (
            <TrendChart data={data.trend} />
          )}
        </div>

        <div className="card p-4 flex flex-col">
          <header className="mb-3">
            <h2 className="font-semibold text-slate-800">
              งบประมาณปี {data.budget.fiscalYear ?? "-"}
            </h2>
            <p className="text-xs text-slate-500">{data.budget.projects} โครงการ</p>
          </header>

          {data.budget.total === 0 ? (
            <EmptyBox text="ยังไม่มีโครงการที่บันทึกงบประมาณ" />
          ) : (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {money(remaining)}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">คงเหลือ (บาท)</div>
              </div>

              <div>
                <div className="meter">
                  <span
                    style={{
                      width: `${Math.min(100, spentPct)}%`,
                      background: spentPct > 90 ? "var(--status-serious)" : "var(--series-1)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-slate-500">
                    เบิกจ่าย {money(data.budget.spent)}
                  </span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {spentPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <dl className="text-sm border-t pt-3 space-y-1">
                <div className="flex justify-between">
                  <dt className="text-slate-500">ได้รับจัดสรร</dt>
                  <dd className="tabular-nums font-medium">{money(data.budget.total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">เบิกจ่ายแล้ว</dt>
                  <dd className="tabular-nums font-medium">{money(data.budget.spent)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </section>

      {/* ═══ โรคติดต่อ + PCU ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <header className="mb-3">
            <h2 className="font-semibold text-slate-800">ผู้ป่วยโรคติดต่อ 12 เดือนล่าสุด</h2>
            <p className="text-xs text-slate-500">จากทะเบียนผู้ป่วย (รง.506) 5 อันดับแรก</p>
          </header>
          {data.diseases.length === 0 ? (
            <EmptyBox text="ยังไม่มีการบันทึกผู้ป่วยโรคติดต่อ" />
          ) : (
            <ul className="space-y-2.5">
              {data.diseases.map((d, i) => {
                const max = Math.max(...data.diseases.map((x) => x.value));
                return (
                  <li key={d.label}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm text-slate-700 truncate">{d.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {nf(d.value)} ราย
                      </span>
                    </div>
                    <div className="meter">
                      <span
                        style={{
                          width: `${(d.value / max) * 100}%`,
                          background: SERIES[i % SERIES.length],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <header className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">มาตรฐานบริการปฐมภูมิ (PCU)</h2>
              <p className="text-xs text-slate-500">เกณฑ์ พ.ศ. 2566 — 8 หมวด 253 คะแนน</p>
            </div>
            <Link href="/m/pcu" className="text-xs text-brand-700 hover:underline shrink-0">
              ดูทั้งหมด
            </Link>
          </header>

          {!data.pcuAssessed ? (
            <EmptyBox text="ยังไม่ได้ประเมินตนเอง — เริ่มให้คะแนนที่เมนูมาตรฐาน PCU" />
          ) : (
            <ul className="space-y-2">
              {data.pcu.map((c) => (
                <li key={c.no} className="flex items-center gap-2.5">
                  <span className="w-5 text-xs text-slate-400 tabular-nums shrink-0">{c.no}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs text-slate-700 block truncate">{c.name}</span>
                    <span className="meter mt-1 block">
                      <span
                        style={{
                          width: `${c.pct}%`,
                          background: c.passed ? "var(--status-good)" : "var(--status-warn)",
                        }}
                      />
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-slate-600 w-20 text-right shrink-0">
                    {c.score}/{c.full}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ═══ ใกล้หมดอายุ + งานค้าง ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <header className="mb-3">
            <h2 className="font-semibold text-slate-800">ยา / วัคซีน ที่ต้องจัดการก่อน</h2>
            <p className="text-xs text-slate-500">เรียงตามวันหมดอายุที่ใกล้ที่สุด</p>
          </header>
          {data.expiringList.length === 0 ? (
            <EmptyBox text="ไม่มีรายการใกล้หมดอายุใน 120 วัน" />
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-xs">
                  <tr>
                    <th className="text-left font-medium px-4 py-1.5">รายการ</th>
                    <th className="text-right font-medium px-2 py-1.5">คงเหลือ</th>
                    <th className="text-right font-medium px-4 py-1.5">เหลืออีก</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiringList.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <div className="text-slate-800 truncate max-w-[14rem]">{it.name}</div>
                        <div className="text-xs text-slate-400">
                          {it.kind === "vaccine" ? "วัคซีน" : "ยา"} · ล็อต {it.lotNo || "-"}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                        {nf(it.qty)} {it.unit ?? ""}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <ExpiryBadge days={it.daysLeft} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-4">
          <header className="mb-3">
            <h2 className="font-semibold text-slate-800">งานค้างที่ต้องติดตาม</h2>
            <p className="text-xs text-slate-500">รายการที่ระบบตรวจพบว่ายังไม่เรียบร้อย</p>
          </header>
          {data.pending.length === 0 ? (
            <EmptyBox text="ไม่มีงานค้าง — ทุกอย่างเรียบร้อย" tone="good" />
          ) : (
            <ul className="space-y-1.5">
              {data.pending.map((p) => (
                <li key={p.label}>
                  <Link
                    href={p.href}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                  >
                    <span className="text-sm text-slate-700">{p.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                      {nf(p.count)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ═══ ข่าว + กิจกรรมล่าสุด ═══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold text-slate-800 mb-3">ข่าวประชาสัมพันธ์</h2>
          {data.news.length === 0 ? (
            <EmptyBox text="ยังไม่มีข่าวประชาสัมพันธ์" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.news.map((n) => (
                <li key={n.id} className="py-2 flex gap-3 text-sm">
                  <span className="text-xs text-slate-400 w-24 shrink-0 tabular-nums">
                    {n.publish_date
                      ? new Date(n.publish_date).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })
                      : "-"}
                  </span>
                  <span className="text-slate-700">{n.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-slate-800 mb-3">กิจกรรมล่าสุดในระบบ</h2>
          {data.activity.length === 0 ? (
            <EmptyBox text="ยังไม่มีกิจกรรม" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.activity.map((a, i) => (
                <li key={i} className="py-2 text-sm flex gap-3">
                  <span className="text-xs text-slate-400 w-24 shrink-0 tabular-nums">
                    {new Date(a.created_at).toLocaleString("th-TH", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0">
                    <span className="text-slate-700">{a.action}</span>
                    {a.detail && <span className="text-slate-400"> — {a.detail}</span>}
                    <span className="block text-xs text-slate-400">{a.full_name ?? "-"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─────────── ชิ้นส่วนย่อย ─────────── */

function StatTile({
  icon,
  label,
  value,
  unit,
  href,
  tone,
  note,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  href: string;
  tone: "neutral" | "good" | "warn" | "serious" | "critical";
  note?: string;
}) {
  const toneRing: Record<string, string> = {
    neutral: "bg-slate-50 text-slate-600",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    serious: "bg-orange-50 text-orange-700",
    critical: "bg-rose-50 text-rose-700",
  };

  return (
    <Link href={href} className="card card-hover p-4 block">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${toneRing[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
        {nf(value)}
        <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </div>
      <div className="text-xs text-slate-500 mt-1.5">{label}</div>
      {note && <div className="text-[11px] text-slate-400 mt-0.5">{note}</div>}
    </Link>
  );
}

function ExpiryBadge({ days }: { days: number }) {
  let cls = "bg-amber-50 text-amber-700";
  let text = `${days} วัน`;
  if (days < 0) {
    cls = "bg-rose-100 text-rose-700";
    text = `หมดอายุแล้ว`;
  } else if (days <= 30) {
    cls = "bg-rose-50 text-rose-700";
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{text}</span>;
}

function EmptyBox({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" }) {
  return (
    <div
      className={`text-sm text-center py-10 rounded-lg border border-dashed ${
        tone === "good"
          ? "text-emerald-600 border-emerald-200 bg-emerald-50/40"
          : "text-slate-400 border-slate-200"
      }`}
    >
      {text}
    </div>
  );
}

function TrendChart({ data }: { data: { label: string; value: number }[] }) {
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
            borderColor: "#2a78d6",
            backgroundColor: "rgba(42,120,214,0.08)",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#2a78d6",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        /* ปิดอนิเมชัน — กันจุดข้อมูลคำนวณตำแหน่งผิดตอน container ยังปรับขนาดไม่เสร็จ */
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 10,
            titleFont: { family: "inherit" },
            bodyFont: { family: "inherit" },
            callbacks: {
              label: (ctx) => ` ${Number(ctx.parsed.y).toLocaleString("th-TH")} ราย`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "#e8edf1" },
            ticks: { color: "#94a3b8", font: { size: 11 } },
          },
          x: {
            border: { display: false },
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11 } },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  /* Chart.js ต้องการ wrapper ที่มีความสูงแน่นอนและ position: relative
     ไม่งั้นจุดข้อมูลจะคำนวณตำแหน่งผิดตอนโหลดครั้งแรก */
  return (
    <div className="relative w-full h-64">
      <canvas ref={ref} />
    </div>
  );
}
