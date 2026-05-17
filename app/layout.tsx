import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한글소리 AI | HwpVoice",
  description: "한글 문서를 AI 음성 브리핑과 공유 페이지로 바꿉니다.",
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
