import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { getLeaveType } from "@/lib/leave-types";
import { getLeaveQuota } from "@/lib/leave";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface LeaveDoc {
  id: number;
  doc_no: string | null;
  leave_type: string;
  fiscal_year: number;
  written_date: string | null;
  start_date: string;
  end_date: string;
  total_days: string;
  reason: string | null;
  contact_address: string | null;
  contact_phone: string | null;
  substitute_name: string | null;
  status: string;
  approver_name: string | null;
  supervisor_comment: string | null;
  personnel_id: number;
  personnel_name: string;
  personnel_position: string | null;
  department: string | null;
}

function thai(iso: string | null | undefined): string {
  if (!iso) return ".......................";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PrintLeavePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "personnel")) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const doc = await queryOne<LeaveDoc>(
    `SELECT lr.*,
            TRIM(CONCAT(p.prefix, p.first_name, ' ', p.last_name)) AS personnel_name,
            p.position AS personnel_position,
            p.department
     FROM leave_request lr JOIN personnel p ON p.id = lr.personnel_id
     WHERE lr.id = $1`,
    [id],
  );
  if (!doc) notFound();

  const org = await queryOne<{ org_name: string; director_name: string; director_title: string }>(
    `SELECT org_name, director_name, director_title FROM org_settings WHERE id = 1`,
  );

  const type = getLeaveType(doc.leave_type);
  const quotas = await getLeaveQuota(doc.personnel_id, doc.fiscal_year, doc.id);
  const quota = quotas.find((q) => q.code === doc.leave_type);

  const dots = (n = 30) => " ".repeat(n);

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div className="gov-doc bg-white mx-auto shadow-lg print:shadow-none" style={{ width: "21cm", padding: "1.5cm 2cm" }}>
        <div className="text-right text-[14pt] mb-2">
          เลขที่ {doc.doc_no ?? "-"}
        </div>

        <h1 className="mb-6">แบบใบ{type?.label ?? doc.leave_type}</h1>

        <div className="text-right mb-4">
          เขียนที่ {org?.org_name ?? "โรงพยาบาลส่งเสริมสุขภาพตำบล"}
        </div>
        <div className="text-right mb-6">วันที่ {thai(doc.written_date)}</div>

        <div className="mb-3">เรื่อง ขอ{type?.label ?? doc.leave_type}</div>
        <div className="mb-5">เรียน {org?.director_title || "ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบล"}</div>

        <p className="indent-16 leading-loose mb-4">
          ข้าพเจ้า <u>{doc.personnel_name}</u> ตำแหน่ง{" "}
          <u>{doc.personnel_position ?? dots(20)}</u> สังกัด{" "}
          <u>{doc.department ?? org?.org_name ?? dots(20)}</u> ขอ
          <u>{type?.label ?? doc.leave_type}</u> เนื่องจาก{" "}
          <u>{doc.reason ?? dots(40)}</u>
        </p>

        <p className="indent-16 leading-loose mb-4">
          ตั้งแต่วันที่ <u>{thai(doc.start_date)}</u> ถึงวันที่ <u>{thai(doc.end_date)}</u>{" "}
          มีกำหนด <u>{Number(doc.total_days).toLocaleString("th-TH")}</u> วันทำการ
        </p>

        <p className="indent-16 leading-loose mb-4">
          ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ <u>{doc.contact_address ?? dots(40)}</u>{" "}
          โทรศัพท์ <u>{doc.contact_phone ?? dots(15)}</u>
          {doc.substitute_name && (
            <>
              {" "}โดยมอบหมายให้ <u>{doc.substitute_name}</u> เป็นผู้ปฏิบัติงานแทน
            </>
          )}
        </p>

        <div className="text-right mt-10 mb-8 leading-loose">
          <div>ขอแสดงความนับถือ</div>
          <div className="mt-8">(ลงชื่อ) ................................................</div>
          <div>( {doc.personnel_name} )</div>
        </div>

        {/* สถิติการลาในปีงบประมาณ ตามแบบใบลาราชการ */}
        <table className="mb-6">
          <thead>
            <tr>
              <th colSpan={4}>สถิติการลาในปีงบประมาณ {doc.fiscal_year}</th>
            </tr>
            <tr>
              <th>ประเภทการลา</th>
              <th>ลามาแล้ว (วันทำการ)</th>
              <th>ลาครั้งนี้ (วันทำการ)</th>
              <th>รวมเป็น (วันทำการ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{type?.label ?? doc.leave_type}</td>
              <td className="text-center">{quota?.usedDays ?? 0}</td>
              <td className="text-center">{Number(doc.total_days)}</td>
              <td className="text-center">
                {(quota?.usedDays ?? 0) + Number(doc.total_days)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 leading-loose">
          <div>
            <div className="font-semibold mb-2">ความเห็นผู้บังคับบัญชา</div>
            <div className="min-h-[3rem] border-b border-dotted border-slate-400 mb-1">
              {doc.supervisor_comment ?? ""}
            </div>
            <div className="mt-6">(ลงชื่อ) ..................................</div>
            <div>ตำแหน่ง ..................................</div>
            <div>วันที่ ....... / ....... / .......</div>
          </div>

          <div>
            <div className="font-semibold mb-2">คำสั่ง</div>
            <div className="space-y-1 mb-3">
              <div>
                <span className="inline-block w-5">{doc.status === "approved" ? "☑" : "☐"}</span> อนุญาต
              </div>
              <div>
                <span className="inline-block w-5">{doc.status === "rejected" ? "☑" : "☐"}</span> ไม่อนุญาต
              </div>
            </div>
            <div className="mt-6">(ลงชื่อ) ..................................</div>
            <div>( {doc.approver_name ?? org?.director_name ?? "................................"} )</div>
            <div>ตำแหน่ง {org?.director_title ?? ".............................."}</div>
            <div>วันที่ ....... / ....... / .......</div>
          </div>
        </div>
      </div>
    </div>
  );
}
