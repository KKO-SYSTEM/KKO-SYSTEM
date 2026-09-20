"use client";

/** ปุ่มพิมพ์สำหรับหน้ารายงานที่อยู่ในระบบ (ไม่ใช่หน้าพิมพ์เอกสารแยก) */
export default function PrintInlineButton({ label = "🖨 พิมพ์รายงาน" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print text-sm px-3.5 py-2 rounded-lg border bg-white hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
