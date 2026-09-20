import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { getOrg, orDots, thaiDate } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface Doc {
  id: number;
  doc_no: string | null;
  item_detail: string | null;
  borrower_name: string;
  borrower_dept: string | null;
  reason: string | null;
  loan_date: Date;
  due_date: Date;
  returned_date: Date | null;
  return_condition: string | null;
  status: string;
  approver_name: string | null;
  inspector_name: string | null;
  note: string | null;
  asset_code: string | null;
  asset_name: string | null;
  serial_no: string | null;
}

/** ใบยืม - คืนพัสดุ/ครุภัณฑ์ ตามระเบียบพัสดุ พ.ศ. 2560 */
export default async function PrintAssetLoanPage({
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

  const doc = await queryOne<Doc>(
    `SELECT l.*, a.asset_code, a.name AS asset_name, a.serial_no
     FROM asset_loan l LEFT JOIN asset a ON a.id = l.asset_id
     WHERE l.id = $1`,
    [id],
  );
  if (!doc) notFound();

  const org = await getOrg();
  const itemText = doc.asset_name
    ? `${doc.asset_name}${doc.asset_code ? ` (รหัส ${doc.asset_code})` : ""}`
    : (doc.item_detail ?? ".".repeat(35));

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <GovDocHeader org={org} title="ใบยืม - คืนพัสดุ / ครุภัณฑ์" docNo={doc.doc_no} />

        <div className="text-right mb-4">วันที่ {thaiDate(doc.loan_date)}</div>

        <div className="mb-3">เรียน {org.director_title ?? "ผู้อำนวยการ"}</div>

        <p className="indent-16 leading-loose mb-3">
          ข้าพเจ้า <u>{doc.borrower_name}</u> สังกัด <u>{orDots(doc.borrower_dept, 25)}</u>{" "}
          ขอยืมพัสดุ/ครุภัณฑ์ของทางราชการ ดังนี้
        </p>

        <table className="mb-4">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>ลำดับ</th>
              <th style={{ width: "22%" }}>รหัสพัสดุ</th>
              <th>รายการ</th>
              <th style={{ width: "22%" }}>หมายเลขเครื่อง</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center">1</td>
              <td>{doc.asset_code ?? "-"}</td>
              <td>{itemText}</td>
              <td>{doc.serial_no ?? "-"}</td>
            </tr>
          </tbody>
        </table>

        <p className="indent-16 leading-loose mb-3">
          เพื่อใช้ในงาน <u>{orDots(doc.reason, 45)}</u>
        </p>

        <p className="indent-16 leading-loose mb-3">
          ตั้งแต่วันที่ <u>{thaiDate(doc.loan_date)}</u> และจะส่งคืนภายในวันที่{" "}
          <u>{thaiDate(doc.due_date)}</u>
        </p>

        <p className="indent-16 leading-loose mb-8">
          ข้าพเจ้าขอรับผิดชอบดูแลรักษาพัสดุดังกล่าว หากเกิดการชำรุดเสียหายหรือสูญหาย
          ข้าพเจ้ายินยอมชดใช้ตามระเบียบของทางราชการทุกประการ
        </p>

        <div className="grid grid-cols-2 gap-8 text-center leading-loose">
          <div>
            <div>(ลงชื่อ) ................................................ ผู้ยืม</div>
            <div>( {doc.borrower_name} )</div>
          </div>
          <div>
            <div>(ลงชื่อ) ................................................ ผู้อนุมัติ</div>
            <div>( {orDots(doc.approver_name ?? org.director_name, 25)} )</div>
            <div>{org.director_title ?? "ผู้อำนวยการ"}</div>
          </div>
        </div>

        <div className="border-t mt-10 pt-4 leading-loose">
          <div className="font-bold mb-3">บันทึกการรับคืน</div>
          <div className="mb-2">
            ได้รับคืนพัสดุรายการข้างต้นเมื่อวันที่{" "}
            <u>{doc.returned_date ? thaiDate(doc.returned_date) : ".".repeat(25)}</u>
          </div>
          <div className="mb-6">
            สภาพพัสดุ <u>{orDots(doc.return_condition, 40)}</u>
          </div>
          <div className="text-right">
            <div>(ลงชื่อ) ................................................ ผู้รับคืน</div>
            <div>( {orDots(doc.inspector_name, 25)} )</div>
          </div>
        </div>

        {doc.note && <div className="mt-4">หมายเหตุ {doc.note}</div>}
      </div>
    </div>
  );
}
