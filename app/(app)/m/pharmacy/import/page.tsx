import StockPageShell from "@/components/StockPageShell";
import InvoiceImport from "@/components/InvoiceImport";

export const dynamic = "force-dynamic";

export default function PharmacyImportPage() {
  return (
    <StockPageShell
      moduleKey="pharmacy"
      title="📥 นำเข้า Invoice จาก รพ.แม่ข่าย"
      subtitle="รับยาเข้าคลังจากใบส่งของ โดยนำเข้าทีละหลายรายการพร้อมล็อตและวันหมดอายุ"
    >
      <InvoiceImport kind="drug" />
    </StockPageShell>
  );
}
