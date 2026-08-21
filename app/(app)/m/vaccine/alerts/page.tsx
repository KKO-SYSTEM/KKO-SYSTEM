import StockPageShell from "@/components/StockPageShell";
import StockAlerts from "@/components/StockAlerts";

export const dynamic = "force-dynamic";

export default function VaccineAlertsPage() {
  return (
    <StockPageShell
      moduleKey="vaccine"
      title="⚠️ วัคซีนใกล้หมดอายุ"
      subtitle="เฝ้าระวังวัคซีนที่หมดอายุแล้ว ใกล้หมดอายุภายใน 90 วัน และรายการที่ต้องเบิกเพิ่ม"
    >
      <StockAlerts kind="vaccine" />
    </StockPageShell>
  );
}
