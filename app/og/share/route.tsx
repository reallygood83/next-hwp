import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = trimText(url.searchParams.get("title") || "AI 음성 브리핑", 34);
  const source = trimText(url.searchParams.get("source") || "HWP/HWPX 문서", 32);
  const backgroundUrl = new URL("/landing-briefing-hero_001.jpg", url.origin).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(15,23,42,.92) 0%, rgba(15,23,42,.68) 47%, rgba(15,23,42,.22) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 64,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 22px 16px 16px",
            borderRadius: 26,
            background: "rgba(7, 20, 32, .78)",
            border: "1px solid rgba(153, 246, 228, .32)",
            boxShadow: "0 18px 48px rgba(0,0,0,.32)",
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "#0f766e",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 64 64">
              <path d="M19 12h19l9 9v31H19V12z" fill="#ffffff" />
              <path d="M38 13v10h10" fill="#d6f1ee" />
              <path d="M26 37v-7" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
              <path d="M33 42V25" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
              <path d="M40 37v-7" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "#ffffff",
                fontSize: 44,
                fontWeight: 800,
                lineHeight: 1.08,
                textShadow: "0 3px 14px rgba(0,0,0,.55)",
              }}
            >
              한글소리 AI
            </div>
            <div
              style={{
                color: "#5eead4",
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.25,
                textShadow: "0 2px 10px rgba(0,0,0,.45)",
              }}
            >
              HwpVoice
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 74,
            bottom: 76,
            width: 760,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.16,
              letterSpacing: 0,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#d1fae5",
              fontSize: 25,
              fontWeight: 700,
            }}
          >
            <span>AI 음성 브리핑</span>
            <span style={{ color: "#5eead4" }}>·</span>
            <span>공유 HTML</span>
          </div>
          <div style={{ color: "#e2e8f0", fontSize: 22 }}>{source}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function trimText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}
