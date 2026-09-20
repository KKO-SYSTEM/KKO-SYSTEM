import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { bahtText, getOrg, nfmt, orDots, thaiDate } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface Doc {
  id: number;
  doc_no: string | null;
  req_date: Date;
  department: string | null;
  purpose: string | null;
  status: string;
  requester_name: string | null;
  orderer_name: string | null;
  issuer_name: string | null;
  receiver_name: string | null;
  recorder_name: string | null;
  note: string | null;
}

interface Item {
  code: string;
  name: string;
  unit: string | null;
  qty_requested: string;
  qty_issued: string | null;
  unit_price: string | null;
}

/** แบบ 8707 — ใบเบิกพัสดุ ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างฯ */
export default async function PrintSupplyRequisitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "equipment")) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const doc = await queryOne<Doc>(`SELECT * FROM supply_requisition WHERE id = $1`, [id]);
  if (!doc) notFound();

  const [items, org] = await Promise.all([
    query<Item>(
      `SELECT s.code, s.name, s.unit, i.qty_requested::text, i.qty_issued::text,
              COALESCE(i.unit_price, s.unit_price)::text AS unit_price
       FROM supply_requisition_item i
       JOIN supply_item s ON s.id = i.item_id
       WHERE i.requisition_id = $1
       ORDER BY i.id`,
      [id],
    ),
    getOrg(),
  ]);

  const amountOf = (it: Item) =>
    Number(it.qty_issued ?? it.qty_requested) * Number(it.unit_price ?? 0);
  const total = items.reduce((sum, it) => sum + amountOf(it), 0);
  const rows = [...items, ...Array(Math.max(0, 8 - items.length)).fill(null)] as (Item | null)[];

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <div className="text-right text-[13pt] mb-1">แบบ 8707</div>
        <GovDocHeader org={org} title="ใบเบิกพัสดุ" docNo={doc.doc_no} />

        <div className="flex justify-between mb-4">
          <div>หน่วยงานที่ขอเบิก {orDots(doc.department, 25)}</div>
          <div>วันที่ {thaiDate(doc.req_date)}</div>
        </div>

        <div className="mb-4">เพื่อใช้ในราชการ {orDots(doc.purpose, 50)}</div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "7%" }}>ลำดับ</th>
              <th style={{ width: "14%" }}>รหัส</th>
              <th>รายการ</th>
              <th style={{ width: "10%" }}>หน่วย</th>
              <th style={{ width: "10%" }}>ขอเบิก</th>
              <th style={{ width: "10%" }}>จ่ายจริง</th>
              <th style={{ width: "12%" }}>ราคา/หน่วย</th>
              <th style={{ width: "13%" }}>จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => (
              <tr key={idx}>
                <td className="text-center">{it ? idx + 1 : ""}</td>
                <td>{it?.code ?? ""}</td>
                <td>{it?.name ?? ""}</td>
                <td className="text-center">{it?.unit ?? ""}</td>
                <td className="text-right">{it ? nfmt(it.qty_requested) : ""}</td>
                <td className="text-right">{it?.qty_issued ? nfmt(it.qty_issued) : ""}</td>
                <td className="text-right">{it?.unit_price ? nfmt(it.unit_price) : ""}</td>
                <td className="text-right">{it ? nfmt(amountOf(it)) : ""}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} className="text-right font-bold">
                รวมเป็นเงินทั้งสิ้น
              </td>
              <td className="text-right font-bold">{nfmt(total)}</td>
            </tr>
            <tr>
              <td colSpan={8} className="text-center">
                ({bahtText(total)})
              </td>
            </tr>
          </tbody>
        </table>

        {doc.note && <div className="mt-3">หมายเหตุ {doc.note}</div>}

        <div className="grid grid-cols-2 gap-8 mt-12 text-center leading-loose">
          <div>
            <div>(ลงชื่อ) ................................................ ผู้ขอเบิก</div>
            <div>( {orDots(doc.requester_name, 25)} )</div>
          </div>
          <div>
            <div>(ลงชื่อ) ................................................ ผู้สั่งจ่าย</div>
            <div>( {orDots(doc.orderer_name ?? org.director_name, 25)} )</div>
            <div>{org.director_title ?? "ผู้อำนวยการ"}</div>
          </div>
          <div className="mt-8">
            <div>(ลงชื่อ) ................................................ ผู้จ่ายพัสดุ</div>
            <div>( {orDots(doc.issuer_name, 25)} )</div>
          </div>
          <div className="mt-8">
            <div>(ลงชื่อ) ................................................ ผู้รับพัสดุ</div>
            <div>( {orDots(doc.receiver_name, 25)} )</div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div>(ลงชื่อ) ................................................ ผู้บันทึกบัญชีพัสดุ</div>
          <div>( {orDots(doc.recorder_name, 25)} )</div>
        </div>
      </div>
    </div>
  );
}
