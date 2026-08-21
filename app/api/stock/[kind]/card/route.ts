import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { getStockCard } from "@/lib/stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_OF: Record<string, string> = { drug: "pharmacy", vaccine: "vaccine" };

/** GET /api/stock/[kind]/card?itemId= — Stock Card ของรายการเดียว */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (kind !== "drug" && kind !== "vaccine") {
    return NextResponse.json({ error: "ประเภทคลังไม่ถูกต้อง" }, { status: 400 });
  }

  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canAccessModule(user.role, MODULE_OF[kind])) {
    return NextResponse.json({ error: "คุณไม่มีสิทธิ์เข้าถึงคลังนี้" }, { status: 403 });
  }

  const itemId = Number(new URL(req.url).searchParams.get("itemId"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "กรุณาระบุรายการที่ต้องการดู Stock Card" }, { status: 400 });
  }

  try {
    const card = await getStockCard(itemId);
    if (!card) return NextResponse.json({ error: "ไม่พบรายการที่ระบุ" }, { status: 404 });
    if (card.item.kind !== kind) {
      return NextResponse.json({ error: "รายการนี้ไม่ได้อยู่ในคลังที่เลือก" }, { status: 400 });
    }
    return NextResponse.json(card);
  } catch (err) {
    console.error("stock card failed:", err);
    return NextResponse.json({ error: "อ่าน Stock Card ไม่สำเร็จ" }, { status: 500 });
  }
}
