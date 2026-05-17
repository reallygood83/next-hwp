import type { BriefingResult } from "./types";

type BuildBriefingHtmlOptions = {
  audioFilename: string;
  embeddedAudio?: {
    mimeType: string;
    base64: string;
  };
  sourceHtml?: string;
};

export function buildBriefingHtml(result: BriefingResult, options: BuildBriefingHtmlOptions) {
  const keyPoints = result.keyPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("\n");
  const caveats = result.caveats
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("\n");
  const audioSrc = options.embeddedAudio
    ? `data:${options.embeddedAudio.mimeType};base64,${options.embeddedAudio.base64}`
    : `./${escapeHtml(options.audioFilename)}`;
  const sourceSection = options.sourceHtml
    ? `<h2>원문 보기</h2><section class="source-doc">${sanitizeHtmlFragment(options.sourceHtml)}</section>`
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(result.title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2430; }
    main { max-width: 860px; margin: 0 auto; padding: 36px 20px; }
    article { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 24px; }
    h1 { margin-top: 0; font-size: 30px; }
    p, li { line-height: 1.7; }
    .summary { color: #344054; font-size: 18px; }
    .script { white-space: pre-wrap; background: #fbfcfd; border: 1px solid #d9dee7; border-radius: 8px; padding: 16px; }
    .source-doc { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 20px; box-shadow: 0 12px 30px rgba(24,37,56,.08); }
    .source-doc p { margin: 0 0 12px; }
    audio { width: 100%; margin: 16px 0; }
  </style>
</head>
<body>
  <main>
    <article>
      <h1>${escapeHtml(result.title)}</h1>
      <p class="summary">${escapeHtml(result.oneLineSummary)}</p>
      <audio controls src="${audioSrc}"></audio>
      <h2>핵심 포인트</h2>
      <ul>${keyPoints}</ul>
      <h2>브리핑 대본</h2>
      <div class="script">${escapeHtml(result.briefingScript)}</div>
      ${sourceSection}
      <h2>주의</h2>
      <ul>${caveats || "<li>원문 기반 AI 요약이며 중요한 판단 전 원문을 확인하세요.</li>"}</ul>
    </article>
  </main>
</body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeHtmlFragment(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
