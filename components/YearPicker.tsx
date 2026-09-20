"use client";

import { useRouter } from "next/navigation";

/**
 * ตัวเลือกปีงบประมาณสำหรับหน้ารายงาน — เปลี่ยนค่าแล้วโหลดหน้าใหม่ด้วย query string
 *
 * อ่านค่าเดิมจาก window.location แทน useSearchParams เพื่อไม่ต้องมี Suspense ครอบ
 */
export default function YearPicker({
  year,
  paramName = "year",
  label = "ปีงบประมาณ",
  span = 3,
}: {
  year: number;
  paramName?: string;
  label?: string;
  span?: number;
}) {
  const router = useRouter();

  function change(value: string) {
    const next = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    if (value) next.set(paramName, value);
    else next.delete(paramName);
    router.push(`${window.location.pathname}?${next.toString()}`);
  }

  const years = Array.from({ length: span * 2 + 1 }, (_, i) => year - span + i);

  return (
    <label className="no-print inline-flex items-center gap-2 text-sm">
      <span className="text-slate-500 whitespace-nowrap">{label}</span>
      <select
        value={year}
        onChange={(e) => change(e.target.value)}
        className="border rounded-lg px-2.5 py-2 text-sm bg-white"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
