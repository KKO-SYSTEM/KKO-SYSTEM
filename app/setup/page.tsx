"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SetupStatus {
  envReady: boolean;
  dbReady: boolean;
  hasUser: boolean;
  missing: string[];
  error?: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [withSample, setWithSample] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ envReady: false, dbReady: false, hasUser: false, missing: [] }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName, withSample }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ติดตั้งไม่สำเร็จ");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        กำลังตรวจสอบสถานะระบบ...
      </div>
    );
  }

  /* ยังไม่ได้ตั้งค่า environment variables */
  if (!status.envReady) {
    return (
      <Shell title="ตั้งค่าระบบครั้งแรก">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
          ยังตั้งค่าไม่ครบ — ระบบต้องการค่าต่อไปนี้ก่อนจึงจะใช้งานได้
        </div>
        <ul className="space-y-2 mb-4">
          {status.missing.map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm">
              <span className="text-rose-500">✕</span>
              <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{m}</code>
            </li>
          ))}
        </ul>
        <div className="text-sm text-slate-500 space-y-3">
          <p className="font-medium text-slate-700">วิธีตั้งค่าบน Vercel</p>
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>เปิดโปรเจกต์บน Vercel → Settings → Environment Variables</li>
            <li>
              เพิ่ม <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">DATABASE_URL</code>{" "}
              = connection string ของฐานข้อมูล PostgreSQL
            </li>
            <li>
              เพิ่ม <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">AUTH_SECRET</code> =
              ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร
            </li>
            <li>กด Redeploy แล้วกลับมาที่หน้านี้อีกครั้ง</li>
          </ol>
          <p className="pt-2">
            ดูวิธีสร้างฐานข้อมูลฟรีได้ในไฟล์ <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">README.md</code>
          </p>
        </div>
      </Shell>
    );
  }

  /* ติดตั้งไปแล้ว */
  if (status.hasUser) {
    return (
      <Shell title="ระบบพร้อมใช้งานแล้ว">
        <p className="text-sm text-slate-500 mb-4">
          ระบบถูกติดตั้งเรียบร้อยแล้ว และมีบัญชีผู้ดูแลระบบอยู่ในระบบ
        </p>
        <a
          href="/login"
          className="inline-block bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium"
        >
          ไปหน้าเข้าสู่ระบบ
        </a>
      </Shell>
    );
  }

  /* ฟอร์มสร้างแอดมินคนแรก */
  return (
    <Shell title="ติดตั้งระบบครั้งแรก">
      <p className="text-sm text-slate-500 mb-5">
        สร้างบัญชีผู้ดูแลระบบคนแรก ระบบจะสร้างตารางฐานข้อมูลทั้งหมดให้อัตโนมัติ
        <br />
        <span className="text-xs text-slate-400">
          หน้านี้จะใช้ได้เพียงครั้งเดียว หลังมีบัญชีแล้วจะถูกปิดโดยอัตโนมัติ
        </span>
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">ชื่อ-สกุล ผู้ดูแลระบบ</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="เช่น นางสาวสุนิสา แก้วมณี"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข)
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            pattern="[a-zA-Z0-9_.\-]{3,32}"
            placeholder="admin"
            autoComplete="username"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={withSample}
            onChange={(e) => setWithSample(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            ใส่ข้อมูลตัวอย่างให้ด้วย
            <span className="block text-xs text-slate-400">
              แนะนำสำหรับการทดลองใช้ — ลบออกภายหลังได้ ถ้าจะใช้งานจริงให้เอาเครื่องหมายออก
            </span>
          </span>
        </label>

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
          {busy ? "กำลังติดตั้งระบบ..." : "ติดตั้งระบบและสร้างบัญชีผู้ดูแล"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600">
      <div className="w-full max-w-lg">
        <div className="text-center mb-5 text-white">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-lg font-bold">RPHC Smart Management System</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
