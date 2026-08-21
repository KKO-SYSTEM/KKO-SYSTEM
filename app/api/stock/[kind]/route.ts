import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canAccessModule, canWriteModule } from "@/lib/permissions";
import { getAlerts, getBalances, getLedger, type StockKind } from "@/lib/stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** kind ในระบบสต๊อก -> module key ที่ใช้ตรวจสิทธิ์ */
const MODULE_OF: Record<string, string> = { drug: "pharmacy", vaccine: "vaccine" };

function parseKind(raw: string): StockKind | null {
  return raw === "drug" || raw === "vaccine" ? raw : null;
}

/**
 * GET /api/stock/[kind]?view=balance|alerts|ledger
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind: rawKind } = await ctx.params;
  const kind = parseKind(rawKind);
  if (!kind) return NextResponse.json({ error: "ประเภทคลังไม่ถูกต้อง" }, { status: 400 });

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const moduleKey = MODULE_OF[kind];
  if (!canAccessModule(user.role, moduleKey)) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงคลังนี้" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "balance";

    if (view === "alerts") {
      return NextResponse.json(await getAlerts(kind));
    }

    if (view === "ledger") {
      const now = new Date();
      const year = Number(url.searchParams.get("year")) || now.getFullYear();
      const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;
      const rows = await getLedger(kind, year, month);
      return NextResponse.json({ year, month, rows });
    }

    const rows = await getBalances(kind, url.searchParams.get("search") ?? undefined);
    return NextResponse.json({ rows, canWrite: canWriteModule(user.role, moduleKey) });
  } catch (err) {
    console.error(`stock ${kind} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อ่านข้อมูลคลังไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
