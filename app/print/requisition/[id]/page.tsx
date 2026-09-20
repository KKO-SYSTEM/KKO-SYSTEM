import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { getRequisition, getRequisitionItems } from "@/lib/requisition";
import { getOrg, nfmt, orDots, thaiDate } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const STATUS_TH: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  issued: "จ่ายแล้ว",
  rejected: "ไม่อนุมัติ",
};

/** ใบเบิกยา / เวชภัณฑ์ / วัคซีน จากคลัง */
export default async function PrintRequisitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const req = await getRequisition(id);
  if (!req) notFound();

  const moduleKey = req.kind === "vaccine" ? "vaccine" : "pharmacy";
  if (!canAccessModule(user.role, moduleKey)) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const [items, org] = await Promise.all([getRequisitionItems(id), getOrg()]);
  const label = req.kind === "vaccine" ? "วัคซีน" : "ยาและเวชภัณฑ์";
  const rows = [...items, ...Array(Math.max(0, 8 - items.length)).fill(null)];

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <GovDocHeader
          org={org}
          title={`ใบเบิก${label}`}
          docNo={req.doc_no}
        />

        <div className="flex justify-between mb-4">
          <div>วันที่ {thaiDate(req.req_date)}</div>
          <div>สถานะ {STATUS_TH[req.status] ?? req.status}</div>
        </div>

        <div className="mb-2">ผู้ขอเบิก {orDots(req.requester, 35)}</div>
        <div className="mb-4">วัตถุประสงค์ / หน่วยงานที่ใช้ {orDots(req.purpose, 45)}</div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>ลำดับ</th>
              <th style={{ width: "16%" }}>รหัส</th>
              <th>รายการ</th>
              <th style={{ width: "12%" }}>หน่วย</th>
              <th style={{ width: "13%" }}>จำนวนที่ขอ</th>
              <th style={{ width: "13%" }}>จำนวนที่จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => (
              <tr key={idx}>
                <td className="text-center">{it ? idx + 1 : ""}</td>
                <td>{it?.code ?? ""}</td>
                <td>{it?.item_name ?? ""}</td>
                <td className="text-center">{it?.unit ?? ""}</td>
                <td className="text-right">{it ? nfmt(it.qty_requested) : ""}</td>
                <td className="text-right">
                  {it && it.qty_issued !== null ? nfmt(it.qty_issued) : ""}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="text-right font-bold">
                รวมทั้งสิ้น
              </td>
              <td className="text-right font-bold">
                {nfmt(items.reduce((s, i) => s + Number(i.qty_requested), 0))}
              </td>
              <td className="text-right font-bold">
                {nfmt(items.reduce((s, i) => s + Number(i.qty_issued ?? 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>

        {req.note && <div className="mt-3">หมายเหตุ {req.note}</div>}

        <div className="grid grid-cols-2 gap-8 mt-12 text-center leading-loose">
          <div>
            <div>(ลงชื่อ) ................................................ ผู้ขอเบิก</div>
            <div>( {orDots(req.requester, 25)} )</div>
            <div>วันที่ {thaiDate(req.req_date)}</div>
          </div>
          <div>
            <div>(ลงชื่อ) ................................................ ผู้อนุมัติ</div>
            <div>( {orDots(req.approver_name ?? org.director_name, 25)} )</div>
            <div>{org.director_title ?? "ผู้อำนวยการ"}</div>
          </div>
          <div className="mt-8">
            <div>(ลงชื่อ) ................................................ ผู้จ่ายของ</div>
            <div>( {orDots(req.issuer_name, 25)} )</div>
          </div>
          <div className="mt-8">
            <div>(ลงชื่อ) ................................................ ผู้รับของ</div>
            <div>( {orDots(req.receiver_name, 25)} )</div>
          </div>
        </div>
      </div>
    </div>
  );
}
