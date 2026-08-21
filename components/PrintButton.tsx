"use client";

export default function PrintButton({ label = "🖨 พิมพ์เอกสาร" }: { label?: string }) {
  return (
    <div className="no-print max-w-[21cm] mx-auto mb-4 flex justify-end gap-2 px-2">
      <button
        onClick={() => window.close()}
        className="text-sm px-4 py-2 rounded-lg border bg-white hover:bg-slate-50"
      >
        ปิดหน้าต่าง
      </button>
      <button
        onClick={() => window.print()}
        className="text-sm px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
      >
        {label}
      </button>
    </div>
  );
}
