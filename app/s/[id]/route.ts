import { getShareById, storageMediaUrl, type ShareRecord } from "@/lib/firebase-rest";
import { contentDisposition } from "@/lib/content-disposition";
import { escapeHtml } from "@/lib/html-export";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await getShareById(id);

  if (!share?.isPublic) {
    return new Response("Shared briefing page not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "html") {
    return new Response(renderSharePage(share, request.url), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": contentDisposition("attachment", `${safeDownloadName(share.title)}.html`),
        "Cache-Control": "private, max-age=0, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(renderSharePage(share, request.url), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; media-src 'self' https://firebasestorage.googleapis.com; frame-src 'self'; style-src 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function renderSharePage(share: ShareRecord, requestUrl: string) {
  const url = new URL(requestUrl);
  const title = share.title || "한글소리 AI 음성 브리핑";
  const description = share.sourceFilename
    ? `${share.sourceFilename} 문서를 한글소리 AI로 변환한 음성 브리핑 공유 페이지입니다.`
    : "한글 문서를 AI 음성 브리핑과 공유 HTML로 변환한 페이지입니다.";
  const imageUrl = new URL("/og/share", url.origin);
  imageUrl.searchParams.set("title", title);
  if (share.sourceFilename) imageUrl.searchParams.set("source", share.sourceFilename);
  const audioSrc = share.audioPath ? storageMediaUrl(share.audioPath) : "";
  const htmlDownloadUrl = new URL(`/s/${share.id}`, url.origin);
  htmlDownloadUrl.searchParams.set("download", "html");
  const audioDownloadUrl = new URL(`/api/shares/${share.id}/audio`, url.origin);
  const pdfViewUrl = new URL(`/api/shares/${share.id}/original-pdf`, url.origin);
  const pdfDownloadUrl = new URL(`/api/shares/${share.id}/original-pdf`, url.origin);
  pdfDownloadUrl.searchParams.set("download", "1");
  const originalPreviewUrl = new URL(`/api/shares/${share.id}/original-preview`, url.origin);
  const originalFileUrl = new URL(`/api/shares/${share.id}/original-file`, url.origin);
  const originalFileDownloadUrl = new URL(`/api/shares/${share.id}/original-file`, url.origin);
  originalFileDownloadUrl.searchParams.set("download", "1");
  const rhwpViewerUrl = new URL("/rhwp-host.html", url.origin);
  rhwpViewerUrl.searchParams.set("url", originalFileUrl.toString());
  rhwpViewerUrl.searchParams.set("filename", share.sourceFilename || "document.hwp");
  const keyPoints = share.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  const caveats =
    share.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("") ||
    "<li>원문 기반 AI 요약이며 중요한 판단 전 원문을 확인하세요.</li>";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttribute(description)}" />
  <meta property="og:site_name" content="한글소리 AI" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeAttribute(title)}" />
  <meta property="og:description" content="${escapeAttribute(description)}" />
  <meta property="og:url" content="${escapeAttribute(url.toString())}" />
  <meta property="og:image" content="${escapeAttribute(imageUrl.toString())}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttribute(title)}" />
  <meta name="twitter:description" content="${escapeAttribute(description)}" />
  <meta name="twitter:image" content="${escapeAttribute(imageUrl.toString())}" />
  <style>
    :root { color-scheme: light; --ink: #182230; --muted: #667085; --line: #d9dee7; --accent: #2f7f73; --soft: #edf8f6; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f6f8; color: var(--ink); }
    main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 48px; }
    .shell { background: white; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(24,34,48,.08); }
    header { padding: 24px 28px 22px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #ffffff 0%, #f9fbfb 100%); }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--accent); font-weight: 900; font-size: 14px; }
    .mark { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; background: var(--accent); color: white; }
    h1 { margin: 18px 0 10px; max-width: 780px; font-size: clamp(30px, 5vw, 48px); line-height: 1.15; letter-spacing: 0; }
    .summary { margin: 0; max-width: 760px; color: #475467; font-size: 19px; line-height: 1.7; }
    .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px; }
    .pill { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border: 1px solid #b8ded9; border-radius: 999px; background: var(--soft); color: #315b5c; font-size: 13px; font-weight: 800; }
    .share-actions { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; }
    .button { display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border: 1px solid #b8ded9; border-radius: 8px; background: var(--soft); color: #245e57; font-weight: 900; text-decoration: none; }
    .content { padding: 28px; display: grid; gap: 24px; }
    audio { width: 100%; }
    .audio-card, section { border: 1px solid var(--line); border-radius: 10px; padding: 20px; background: #fff; }
    .audio-card { background: var(--soft); border-color: #b8ded9; }
    .pdf-frame { width: 100%; min-height: 720px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; }
    .pdf-actions { margin: 12px 0 0; display: flex; flex-wrap: wrap; gap: 10px; }
    h2 { margin: 0 0 12px; font-size: 22px; }
    p, li { line-height: 1.75; }
    ul { margin: 0; padding-left: 22px; }
    .script-panel { border: 1px solid var(--line); border-radius: 10px; background: #fbfcfd; }
    .script-panel summary { cursor: pointer; padding: 16px 18px; font-weight: 900; }
    .script { white-space: pre-wrap; padding: 18px; border-top: 1px solid var(--line); line-height: 1.8; color: #344054; }
    .source { color: #344054; }
    .notice { background: #fff8ed; border-color: #f3c995; color: #8a421f; }
    footer { padding: 18px 28px 26px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 640px) { main { width: min(100% - 20px, 960px); padding-top: 14px; } header, .content, footer { padding-left: 18px; padding-right: 18px; } }
  </style>
</head>
<body>
  <main>
    <article class="shell">
      <header>
        <div class="brand"><span class="mark">소리</span><span>한글소리 AI</span></div>
        <h1>${escapeHtml(title)}</h1>
        <p class="summary">${escapeHtml(share.oneLineSummary)}</p>
        <div class="meta">
          <span class="pill">${escapeHtml(share.sourceFilename || "공유 문서")}</span>
          <span class="pill">${escapeHtml(share.language || "ko")}</span>
          <span class="pill">${escapeHtml(share.speechProvider || "tts")}</span>
        </div>
        <div class="share-actions">
          <a class="button" href="${escapeAttribute(htmlDownloadUrl.toString())}">HTML 저장</a>
          ${audioSrc ? `<a class="button" href="${escapeAttribute(audioDownloadUrl.toString())}">MP3 저장</a>` : ""}
          ${share.originalPdfPath ? `<a class="button" href="${escapeAttribute(pdfDownloadUrl.toString())}">원문 PDF 저장</a>` : ""}
          ${share.originalFilePath ? `<a class="button" href="${escapeAttribute(originalFileDownloadUrl.toString())}">원본 HWP 저장</a>` : ""}
        </div>
      </header>
      <div class="content">
        ${
          audioSrc
            ? `<div class="audio-card"><h2>음성 브리핑</h2><audio controls preload="metadata" src="${escapeAttribute(audioSrc)}"></audio></div>`
            : `<div class="audio-card"><h2>음성 브리핑</h2><p>이 공유에는 별도 오디오 파일이 포함되지 않았습니다.</p></div>`
        }
        <section>
          <h2>핵심 포인트</h2>
          <ul>${keyPoints}</ul>
        </section>
        <details class="script-panel">
          <summary>브리핑 대본 펼치기</summary>
          <div class="script">${escapeHtml(share.briefingScript)}</div>
        </details>
        ${
          share.originalPreviewPath || share.originalPdfPath
            ? `<section>
          <h2>원문 보기</h2>
          <iframe class="pdf-frame" title="원문 미리보기" src="${escapeAttribute((share.originalPreviewPath ? originalPreviewUrl : pdfViewUrl).toString())}"></iframe>
          <div class="pdf-actions">${share.originalPdfPath ? `<a class="button" href="${escapeAttribute(pdfDownloadUrl.toString())}">원문 PDF 저장</a>` : ""}</div>
        </section>`
            : ""
        }
        ${
          share.originalFilePath
            ? `<details class="script-panel">
          <summary>HWP 뷰어로 원문 열기</summary>
          <iframe class="pdf-frame" title="HWP 원문 뷰어" src="${escapeAttribute(rhwpViewerUrl.toString())}"></iframe>
          <div class="pdf-actions"><a class="button" href="${escapeAttribute(originalFileDownloadUrl.toString())}">원본 HWP 저장</a></div>
        </details>`
            : ""
        }
        ${share.htmlBody ? `<section class="source"><h2>요약 본문</h2>${sanitizeSafeFragment(share.htmlBody)}</section>` : ""}
        <section class="notice">
          <h2>주의</h2>
          <ul>${caveats}</ul>
          <p>한글소리 AI는 재능기부 MVP 서비스입니다. 중요한 자료는 원본 파일과 다운로드 파일을 별도로 백업해 주세요.</p>
        </section>
      </div>
      <footer>
        <span>2026 Copyright 배움의 달인</span>
        <span>한글소리 AI / HwpVoice</span>
      </footer>
    </article>
  </main>
</body>
</html>`;
}

function sanitizeSafeFragment(value: string) {
  return value
    .replace(/<(?!\/?(p|h2|ul|li|strong)\b)[^>]*>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function safeDownloadName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "hwpvoice-briefing"
  );
}
