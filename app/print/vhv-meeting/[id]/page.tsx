import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canAccessModule } from "@/lib/permissions";
import { getOrg, orDots, thaiDate } from "@/lib/print";
import GovDocHeader from "@/components/GovDocHeader";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

interface Meeting {
  id: number;
  meeting_no: string | null;
  meeting_date: Date;
  location: string | null;
  agenda: string | null;
  resolution: string | null;
  recorder_name: string | null;
  chairman_name: string | null;
  note: string | null;
}

interface Attendee {
  name: string;
  village_no: string | null;
  status: string;
  note: string | null;
}

/** รายงานการประชุม อสม. พร้อมบัญชีลงเวลาผู้เข้าประชุม */
export default async function PrintVhvMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccessModule(user.role, "vhv")) {
    return <div className="p-8 text-sm text-rose-700">คุณไม่มีสิทธิ์เข้าถึงเอกสารนี้</div>;
  }

  const meeting = await queryOne<Meeting>(`SELECT * FROM vhv_meeting WHERE id = $1`, [id]);
  if (!meeting) notFound();

  const [attendees, org] = await Promise.all([
    query<Attendee>(
      `SELECT TRIM(CONCAT(COALESCE(v.prefix,''), v.first_name, ' ', v.last_name)) AS name,
              v.village_no, a.status, a.note
       FROM vhv_attendance a JOIN vhv v ON v.id = a.vhv_id
       WHERE a.meeting_id = $1
       ORDER BY v.village_no NULLS LAST, v.first_name`,
      [id],
    ),
    getOrg(),
  ]);

  const present = attendees.filter((a) => a.status === "มา" || a.status === "มาสาย").length;
  const rows = [
    ...attendees,
    ...Array(Math.max(0, 10 - attendees.length)).fill(null),
  ] as (Attendee | null)[];

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <PrintButton />

      <div
        className="gov-doc bg-white mx-auto shadow-lg print:shadow-none"
        style={{ width: "21cm", padding: "1.5cm 2cm" }}
      >
        <GovDocHeader
          org={org}
          title="รายงานการประชุมอาสาสมัครสาธารณสุขประจำหมู่บ้าน (อสม.)"
          subtitle={meeting.meeting_no ? `ครั้งที่ ${meeting.meeting_no}` : undefined}
          docNo={undefined}
        />

        <div className="mb-2">วันที่ {thaiDate(meeting.meeting_date)}</div>
        <div className="mb-5">ณ {orDots(meeting.location, 40)}</div>

        <div className="mb-2">
          ผู้เข้าร่วมประชุม {present} คน จากผู้ที่ลงทะเบียนทั้งหมด {attendees.length} คน
        </div>

        <table className="mb-6">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>ลำดับ</th>
              <th>ชื่อ - สกุล</th>
              <th style={{ width: "12%" }}>หมู่ที่</th>
              <th style={{ width: "16%" }}>การเข้าร่วม</th>
              <th style={{ width: "24%" }}>ลายมือชื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr key={idx}>
                <td className="text-center">{a ? idx + 1 : ""}</td>
                <td>{a?.name ?? ""}</td>
                <td className="text-center">{a?.village_no ?? ""}</td>
                <td className="text-center">{a?.status ?? ""}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-2 font-bold">ระเบียบวาระการประชุม</div>
        <div className="mb-5 whitespace-pre-wrap leading-loose">
          {meeting.agenda ?? "-"}
        </div>

        <div className="mb-2 font-bold">มติที่ประชุม</div>
        <div className="mb-8 whitespace-pre-wrap leading-loose">
          {meeting.resolution ?? "-"}
        </div>

        {meeting.note && <div className="mb-6">หมายเหตุ {meeting.note}</div>}

        <div className="grid grid-cols-2 gap-8 mt-10 text-center leading-loose">
          <div>
            <div>(ลงชื่อ) ................................................ ผู้บันทึกรายงาน</div>
            <div>( {orDots(meeting.recorder_name, 25)} )</div>
          </div>
          <div>
            <div>(ลงชื่อ) ................................................ ประธานที่ประชุม</div>
            <div>( {orDots(meeting.chairman_name ?? org.director_name, 25)} )</div>
          </div>
        </div>
      </div>
    </div>
  );
}
