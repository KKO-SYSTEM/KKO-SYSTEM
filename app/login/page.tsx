"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextUrl = params.get("next") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        setBusy(false);
        return;
      }
      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 text-white">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-xl font-bold leading-tight">RPHC Smart Management System</h1>
          <p className="text-sm text-brand-100 mt-1">
            ระบบบริหารจัดการภายในโรงพยาบาลส่งเสริมสุขภาพตำบล
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อผู้ใช้</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium transition"
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          <p className="text-xs text-slate-400 text-center pt-1">
            หากยังไม่มีบัญชี กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างบัญชีให้
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-900" />}>
      <LoginForm />
    </Suspense>
  );
}
