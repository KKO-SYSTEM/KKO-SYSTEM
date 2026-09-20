import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { getOrg, orDots, thaiDate, thaiDateTime } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface Doc {
  id: number;
  doc_no: string | null;
  written_date: Date | null;
  addressed_to: string | null;
  requester_name: string;
  requester_position: string | null;
  destination: string;
  purpose: string | null;
  passenger_count: number | null;
  depart_at: Date | null;
  return_at: Date | null;
  driver_name: string | null;
  status: string;
  supervisor_name: string | null;
  approver_name: string | null;
  note: string | null;
  plate: string | null;
  vehicle_name: string | null;
}

/** แบบ 3 — ใบขออนุญาตใช้รถส่วนกลาง ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยรถราชการ */
export default async function PrintVehicleRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "vehicle")) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const doc = await queryOne<Doc>(
    `SELECT r.*, v.plate, v.vehicle_name
     FROM vehicle_request r LEFT JOIN vehicle v ON v.id = r.vehicle_id
     WHERE r.id = $1`,
    [id],
  );
  if (!doc) notFound();

  const org = await getOrg();

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <div className="text-right text-[13pt] mb-1">แบบ 3</div>
        <GovDocHeader org={org} title="ใบขออนุญาตใช้รถส่วนกลาง" docNo={doc.doc_no} />

        <div className="text-right mb-4">วันที่ {thaiDate(doc.written_date)}</div>

        <div className="mb-3">
          เรียน {orDots(doc.addressed_to ?? org.director_title, 40)}
        </div>

        <p className="indent-16 leading-loose mb-3">
          ข้าพเจ้า <u>{doc.requester_name}</u> ตำแหน่ง{" "}
          <u>{orDots(doc.requester_position, 20)}</u> มีความประสงค์ขออนุญาตใช้รถส่วนกลาง
          หมายเลขทะเบียน <u>{orDots(doc.plate, 15)}</u>{" "}
          {doc.vehicle_name ? `(${doc.vehicle_name})` : ""}
        </p>

        <p className="indent-16 leading-loose mb-3">
          เพื่อเดินทางไป <u>{doc.destination}</u> โดยมีวัตถุประสงค์{" "}
          <u>{orDots(doc.purpose, 40)}</u> จำนวนผู้เดินทาง{" "}
          <u>{doc.passenger_count ?? "...."}</u> คน
        </p>

        <p className="indent-16 leading-loose mb-3">
          ออกเดินทางวันที่ <u>{thaiDateTime(doc.depart_at)}</u> และกำหนดกลับ{" "}
          <u>{thaiDateTime(doc.return_at)}</u>
        </p>

        <p className="indent-16 leading-loose mb-3">
          พนักงานขับรถ <u>{orDots(doc.driver_name, 25)}</u>
        </p>

        {doc.note && <p className="indent-16 leading-loose mb-3">หมายเหตุ {doc.note}</p>}

        <p className="indent-16 leading-loose mb-8">
          จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต
        </p>

        <div className="text-right mb-10 leading-loose">
          <div>(ลงชื่อ) ................................................ ผู้ขอใช้รถ</div>
          <div>( {doc.requester_name} )</div>
          <div>{orDots(doc.requester_position, 20)}</div>
        </div>

        <div className="border-t pt-4 leading-loose">
          <div className="font-bold mb-2">ความเห็นผู้บังคับบัญชา</div>
          <div className="mb-6">
            ( ) เห็นควรอนุญาต ( ) ไม่เห็นควรอนุญาต เพราะ
            ................................................................
          </div>
          <div className="text-right">
            <div>(ลงชื่อ) ................................................</div>
            <div>( {orDots(doc.supervisor_name, 25)} )</div>
          </div>
        </div>

        <div className="border-t mt-6 pt-4 leading-loose">
          <div className="font-bold mb-2">คำสั่งผู้มีอำนาจอนุญาต</div>
          <div className="mb-6">( ) อนุญาต ( ) ไม่อนุญาต</div>
          <div className="text-right">
            <div>(ลงชื่อ) ................................................</div>
            <div>( {orDots(doc.approver_name ?? org.director_name, 25)} )</div>
            <div>{org.director_title ?? "ผู้อำนวยการ"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
