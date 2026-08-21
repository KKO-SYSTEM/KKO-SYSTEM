import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPHC Smart Management System — ระบบบริหารจัดการภายใน รพ.สต.",
  description:
    "ระบบบริหารจัดการครบวงจร เพื่อการทำงานที่มีประสิทธิภาพ โปร่งใส ตรวจสอบได้ และรายงานได้อัตโนมัติ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
