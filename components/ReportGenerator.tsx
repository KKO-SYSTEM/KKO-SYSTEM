"use client";

import { useState } from "react";

const REPORTS = [
  {
    kind: "monthly",
    icon: "📅",
    title: "รายงานสรุปประจำเดือน",
    desc: "รวมสถานะบุคลากร คลังยา ระบาดวิทยา และงบประมาณเป็นรายงานฉบับเดียว",
  },
  {
    kind: "sar",
    icon: "📝",
    title: "รายงานประเมินตนเอง (SAR)",
    desc: "สรุปคะแนนมาตรฐานบริการสุขภาพปฐมภูมิ 8 หมวด พร้อมข้อเสนอแนะ",
  },
  {
    kind: "project",
    icon: "🎯",
    title: "รายงานผลการดำเนินงานโครงการ",
    desc: "สรุปโครงการทั้งปีงบประมาณ พร้อมงบที่ได้รับ เบิกจ่าย และคงเหลือ",
  },
  {
    kind: "meeting",
    icon: "🗒️",
    title: "รายงานการประชุม อสม.",
    desc: "ร่างรายงานการประชุมจากข้อมูลการประชุมและการเข้าร่วมล่าสุด",
  },
];

export default function ReportGenerator() {
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate(kind: string) {
    setBusy(true);
    setError("");
    setActive(kind);
    try {
      const res = await fetch(`/api/reports/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "สร้างรายงานไม่สำเร็จ");
        setText("");
        return;
      }
      setText(data.text);
      setTitle(data.title);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function download(ext: "txt" | "doc") {
    const mime = ext === "doc" ? "application/msword" : "text/plain;charset=utf-8";
    const content =
      ext === "doc"
        ? `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head>` +
          `<body style="font-family:'TH SarabunPSK','Sarabun',sans-serif;font-size:16pt;white-space:pre-wrap">` +
          text.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
          `</body></html>`
        : text;

    const blob = new Blob(["﻿", content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "รายงาน"}.${ext === "doc" ? "doc" : "txt"}`;
    a.click();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* เบราว์เซอร์บางตัวไม่อนุญาต */
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-200 text-brand-800 text-sm rounded-xl p-3">
        รายงานเหล่านี้สร้างจาก <strong>แม่แบบเอกสารราชการ + ข้อมูลจริงในฐานข้อมูล</strong> ของท่าน
        ไม่มีการส่งข้อมูลออกไปยังบริการภายนอก จึงไม่มีค่าใช้จ่ายและข้อมูลไม่รั่วไหล
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORTS.map((r) => (
          <button
            key={r.kind}
            onClick={() => generate(r.kind)}
            disabled={busy}
            className={`text-left bg-white border rounded-xl p-4 transition hover:border-brand-400 disabled:opacity-60
              ${active === r.kind ? "border-brand-500 ring-1 ring-brand-200" : ""}`}
          >
            <div className="text-2xl mb-1.5">{r.icon}</div>
            <div className="font-medium text-slate-700 text-sm">{r.title}</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">{r.desc}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
          <div className="font-semibold text-sm text-slate-700">
            {title || "ผลลัพธ์ร่างรายงาน"}
          </div>
          {text && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copy}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                📋 คัดลอก
              </button>
              <button
                onClick={() => download("doc")}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                ⬇ Word (.doc)
              </button>
              <button
                onClick={() => download("txt")}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                ⬇ ข้อความ (.txt)
              </button>
              <button
                onClick={() => window.print()}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
              >
                🖨 พิมพ์
              </button>
            </div>
          )}
        </div>

        <textarea
          value={busy ? "กำลังรวบรวมข้อมูลจากฐานข้อมูล..." : text}
          onChange={(e) => setText(e.target.value)}
          placeholder="เลือกรายงานที่ต้องการจากด้านบน ระบบจะดึงข้อมูลจริงมาสร้างร่างให้ แล้วท่านแก้ไขข้อความได้"
          className="w-full h-[26rem] p-4 text-sm font-mono resize-none focus:outline-none leading-relaxed"
        />
      </div>
    </div>
  );
}
