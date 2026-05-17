import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next HWP Briefing",
  description: "Create AI voice briefings from HWP/HWPX documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
