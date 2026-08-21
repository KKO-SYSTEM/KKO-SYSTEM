import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasAnyUser, isDatabaseReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const envReady = Boolean(process.env.DATABASE_URL) && Boolean(process.env.AUTH_SECRET);
  if (!envReady) redirect("/setup");

  const dbReady = await isDatabaseReady();
  if (!dbReady || !(await hasAnyUser())) redirect("/setup");

  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
