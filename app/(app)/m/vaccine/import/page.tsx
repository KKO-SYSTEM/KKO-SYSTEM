import StockPageShell from "@/components/StockPageShell";
import InvoiceImport from "@/components/InvoiceImport";

export const dynamic = "force-dynamic";

export default function VaccineImportPage() {
  return (
    <StockPageShell
      moduleKey="vaccine"
      title="📥 นำเข้า Invoice จาก รพ.แม่ข่าย"
      subtitle="รับวัคซีนเข้าคลังจากใบส่งของ พร้อมล็อตและวันหมดอายุรายล็อต"
    >
      <InvoiceImport kind="vaccine" />
    </StockPageShell>
  );
}
