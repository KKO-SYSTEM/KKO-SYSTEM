import StockPageShell from "@/components/StockPageShell";
import StockLedger from "@/components/StockLedger";

export const dynamic = "force-dynamic";

export default function PharmacyLedgerPage() {
  return (
    <StockPageShell
      moduleKey="pharmacy"
      title="📒 ทะเบียนรับ-จ่ายยา (รบ.301)"
      subtitle="สรุปยอดยกมา รับ จ่าย และคงเหลือรายเดือน พิมพ์เป็นเอกสารส่งหน่วยงานต้นสังกัดได้"
    >
      <StockLedger kind="drug" />
    </StockPageShell>
  );
}
