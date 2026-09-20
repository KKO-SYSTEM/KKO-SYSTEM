import type { OrgInfo } from "@/lib/print";

/** หัวเอกสารราชการ — ชื่อหน่วยงาน อำเภอ จังหวัด */
export default function GovDocHeader({
  org,
  title,
  subtitle,
  docNo,
}: {
  org: OrgInfo;
  title: string;
  subtitle?: string;
  docNo?: string | null;
}) {
  return (
    <>
      {docNo !== undefined && (
        <div className="text-right text-[14pt] mb-2">เลขที่ {docNo || "-"}</div>
      )}
      <h1 className="mb-1">{title}</h1>
      {subtitle && <div className="text-center text-[15pt] mb-1">{subtitle}</div>}
      <div className="text-center text-[15pt] mb-5">
        {org.org_name}
        {org.district ? ` อำเภอ${org.district}` : ""}
        {org.province ? ` จังหวัด${org.province}` : ""}
      </div>
    </>
  );
}
