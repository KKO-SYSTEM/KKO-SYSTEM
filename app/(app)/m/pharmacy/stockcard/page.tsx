import StockPageShell from "@/components/StockPageShell";
import StockCard from "@/components/StockCard";

export const dynamic = "force-dynamic";

export default function PharmacyStockCardPage() {
  return (
    <StockPageShell
      moduleKey="pharmacy"
      title="📇 Stock Card — คลังยา"
      subtitle="ทะเบียนรับ-จ่ายยารายรายการ พร้อมยอดคงเหลือต่อเนื่องและการตัดจ่ายตามหลัก FEFO"
    >
      <StockCard kind="drug" />
    </StockPageShell>
  );
}
