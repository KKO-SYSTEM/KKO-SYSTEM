import StockPageShell from "@/components/StockPageShell";
import StockAlerts from "@/components/StockAlerts";

export const dynamic = "force-dynamic";

export default function PharmacyAlertsPage() {
  return (
    <StockPageShell
      moduleKey="pharmacy"
      title="⚠️ ยาใกล้หมดอายุ / ต่ำกว่าเกณฑ์"
      subtitle="เฝ้าระวังยาที่หมดอายุแล้ว ใกล้หมดอายุภายใน 90 วัน และรายการที่ต้องสั่งซื้อเพิ่ม"
    >
      <StockAlerts kind="drug" />
    </StockPageShell>
  );
}
