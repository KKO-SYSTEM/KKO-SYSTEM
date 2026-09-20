import ModulePageShell from "@/components/ModulePageShell";
import PcuScoreBoard from "@/components/PcuScoreBoard";
import { fiscalYearOf } from "@/lib/pcu";

export const dynamic = "force-dynamic";

export default async function PcuScorePage() {
  return (
    <ModulePageShell
      moduleKey="pcu"
      title="📋 คะแนนประเมิน"
      subtitle="มาตรฐาน PCU — 8 หมวด 59 ข้อ รวม 253 คะแนน ตามคู่มือ พ.ศ. 2566"
    >
      <PcuScoreBoard initialYear={fiscalYearOf()} />
    </ModulePageShell>
  );
}
