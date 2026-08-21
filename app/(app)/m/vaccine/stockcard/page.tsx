import StockPageShell from "@/components/StockPageShell";
import StockCard from "@/components/StockCard";

export const dynamic = "force-dynamic";

export default function VaccineStockCardPage() {
  return (
    <StockPageShell
      moduleKey="vaccine"
      title="📇 Stock Card — คลังวัคซีน"
      subtitle="ทะเบียนรับ-จ่ายวัคซีนรายรายการ พร้อมยอดคงเหลือต่อเนื่องและการตัดจ่ายตามหลัก FEFO"
    >
      <StockCard kind="vaccine" />
    </StockPageShell>
  );
}
