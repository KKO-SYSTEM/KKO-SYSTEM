"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLES } from "@/lib/permissions";

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsManager({ currentUserId }: { currentUserId: number }) {
  const [tab, setTab] = useState<"org" | "users">("org");
  const [toast, setToast] = useState("");

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex gap-1 border-b">
        {(
          [
            ["org", "🏥 ข้อมูลหน่วยงาน"],
            ["users", "👤 บัญชีผู้ใช้งาน"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-sm px-4 py-2 rounded-t-lg border-b-2 transition ${
              tab === key
                ? "border-brand-600 text-brand-700 font-medium bg-brand-50"
                : "border-transparent text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "org" ? <OrgSettings notify={notify} /> : <UserSettings currentUserId={currentUserId} notify={notify} />}
    </div>
  );
}

const ORG_FIELDS: { key: string; label: string; help?: string }[] = [
  { key: "org_name", label: "ชื่อหน่วยงาน", help: "ใช้เป็นหัวเอกสารทุกฉบับที่พิมพ์จากระบบ" },
  { key: "parent_org", label: "หน่วยงานต้นสังกัด", help: "เช่น สำนักงานสาธารณสุขอำเภอ..." },
  { key: "district", label: "อำเภอ" },
  { key: "province", label: "จังหวัด" },
  { key: "director_name", label: "ชื่อผู้อำนวยการ" },
  { key: "director_title", label: "ตำแหน่งผู้อำนวยการ" },
  { key: "address", label: "ที่อยู่" },
  { key: "phone", label: "เบอร์โทรศัพท์" },
];

function OrgSettings({ notify }: { notify: (m: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        const v: Record<string, string> = {};
        for (const f of ORG_FIELDS) v[f.key] = String(d.org?.[f.key] ?? "");
        setValues(v);
      })
      .catch(() => setError("อ่านข้อมูลหน่วยงานไม่สำเร็จ"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/org", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      notify("บันทึกข้อมูลหน่วยงานเรียบร้อยแล้ว");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ORG_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {f.help && <p className="text-[11px] text-slate-400 mt-1">{f.help}</p>}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "กำลังบันทึก..." : "บันทึกข้อมูลหน่วยงาน"}
      </button>
    </form>
  );
}

function UserSettings({
  currentUserId,
  notify,
}: {
  currentUserId: number;
  notify: (m: string) => void;
}) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านรายชื่อผู้ใช้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.is_active }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || "ไม่สำเร็จ");
      return;
    }
    notify(u.is_active ? "ปิดการใช้งานบัญชีแล้ว" : "เปิดการใช้งานบัญชีแล้ว");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border">
        <div className="p-4 flex items-center justify-between border-b">
          <div className="font-semibold text-sm text-slate-700">
            บัญชีผู้ใช้งาน ({rows.length})
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="text-sm px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            + เพิ่มผู้ใช้งาน
          </button>
        </div>

        {error && (
          <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">ชื่อผู้ใช้</th>
                <th className="text-left px-4 py-2.5 font-medium">ชื่อ-สกุล</th>
                <th className="text-left px-4 py-2.5 font-medium">บทบาท</th>
                <th className="text-left px-4 py-2.5 font-medium">สถานะ</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-10">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs">{u.username}</td>
                    <td className="px-4 py-2.5">
                      {u.full_name}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 rounded px-1.5 py-0.5">
                          คุณ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {ROLES.find((r) => r.key === u.role)?.label ?? u.role}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {u.is_active ? "ใช้งานได้" : "ปิดการใช้งาน"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditing(u)}
                        className="text-xs px-2 py-1 rounded border hover:bg-slate-50 mr-1"
                      >
                        แก้ไข
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => toggleActive(u)}
                          className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
                        >
                          {u.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 border rounded-xl p-4">
        <div className="text-sm font-medium text-slate-700 mb-2">สิทธิ์ของแต่ละบทบาท</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500">
          {ROLES.map((r) => (
            <div key={r.key} className="flex gap-2">
              <span className="font-medium text-slate-600 shrink-0 w-40">{r.label}</span>
              <span>{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      {(showNew || editing) && (
        <UserForm
          user={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={(m) => {
            setShowNew(false);
            setEditing(null);
            notify(m);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [form, setForm] = useState({
    username: user?.username ?? "",
    fullName: user?.full_name ?? "",
    role: user?.role ?? "office",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(user ? `/api/users/${user.id}` : "/api/users", {
        method: user ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          user
            ? { fullName: form.fullName, role: form.role, password: form.password || undefined }
            : form,
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        setBusy(false);
        return;
      }
      onSaved(user ? "แก้ไขบัญชีเรียบร้อยแล้ว" : "สร้างบัญชีเรียบร้อยแล้ว");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="font-semibold text-slate-800">
            {user ? `แก้ไขบัญชี — ${user.username}` : "เพิ่มบัญชีผู้ใช้งาน"}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {!user && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข) <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                required
                pattern="[a-zA-Z0-9_.\-]{3,32}"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              ชื่อ-สกุล <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              บทบาท <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {ROLES.find((r) => r.key === form.role)?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              รหัสผ่าน {user ? "(เว้นว่างถ้าไม่เปลี่ยน)" : <span className="text-rose-500">*</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required={!user}
              minLength={user ? 0 : 8}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">อย่างน้อย 8 ตัวอักษร</p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
