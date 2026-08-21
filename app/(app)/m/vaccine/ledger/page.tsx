import StockPageShell from "@/components/StockPageShell";
import StockLedger from "@/components/StockLedger";

export const dynamic = "force-dynamic";

export default function VaccineLedgerPage() {
  return (
    <StockPageShell
      moduleKey="vaccine"
      title="📒 ทะเบียนรับ-จ่ายวัคซีน (รบ.301)"
      subtitle="สรุปยอดยกมา รับ จ่าย และคงเหลือรายเดือน พิมพ์เป็นเอกสารส่งหน่วยงานต้นสังกัดได้"
    >
      <StockLedger kind="vaccine" />
    </StockPageShell>
  );
}
