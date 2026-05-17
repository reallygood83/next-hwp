import type { BriefingResult } from "./types";

type BuildBriefingHtmlOptions = {
  audioFilename: string;
  embeddedAudio?: {
    mimeType: string;
    base64: string;
  };
  sourceHtml?: string;
  originalDocument?: {
    filename: string;
    base64: string;
  };
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
  const sourceSection = options.originalDocument
    ? buildOriginalViewer(options.originalDocument)
    : options.sourceHtml
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
    details.script-panel { border: 1px solid #d9dee7; border-radius: 8px; background: #fbfcfd; }
    details.script-panel summary { cursor: pointer; padding: 14px 16px; font-weight: 800; }
    details.script-panel .script { border: 0; border-top: 1px solid #d9dee7; border-radius: 0 0 8px 8px; margin: 0; }
    .source-doc { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 20px; box-shadow: 0 12px 30px rgba(24,37,56,.08); }
    .source-doc p { margin: 0 0 12px; }
    .original-viewer { border: 1px solid #d9dee7; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 12px 30px rgba(24,37,56,.08); }
    .original-viewer-status { min-height: 38px; display: flex; align-items: center; padding: 0 14px; border-bottom: 1px solid #d9dee7; color: #687385; background: #fbfcfd; font-size: 13px; }
    .original-viewer iframe { width: 100%; height: 760px; border: 0; display: block; background: white; }
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
      <details class="script-panel">
        <summary>대본 펼치기</summary>
        <div class="script">${escapeHtml(result.briefingScript)}</div>
      </details>
      ${sourceSection}
      <h2>주의</h2>
      <ul>${caveats || "<li>원문 기반 AI 요약이며 중요한 판단 전 원문을 확인하세요.</li>"}</ul>
    </article>
  </main>
</body>
</html>`;
}

function buildOriginalViewer(document: NonNullable<BuildBriefingHtmlOptions["originalDocument"]>) {
  const viewerId = `viewer-${randomId(document.filename)}`;
  const statusId = `status-${viewerId}`;
  return `<h2>원문 보기</h2>
      <section class="original-viewer">
        <div id="${statusId}" class="original-viewer-status">한글 원문 뷰어를 불러오는 중입니다.</div>
        <iframe id="${viewerId}" title="${escapeHtml(document.filename)} 원문 보기" src="/rhwp-studio/index.html"></iframe>
      </section>
      <script>
        (function () {
          var base64 = "${document.base64}";
          var filename = ${JSON.stringify(document.filename)};
          var frame = document.getElementById("${viewerId}");
          var status = document.getElementById("${statusId}");
          function decodeBase64(value) {
            var binary = atob(value);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return bytes;
          }
          function sendDocument() {
            if (!frame || !frame.contentWindow) return;
            frame.contentWindow.postMessage({
              type: "hwpctl-load",
              fileName: filename,
              data: decodeBase64(base64).buffer
            }, window.location.origin);
          }
          window.addEventListener("message", function (event) {
            if (event.origin !== window.location.origin || !event.data || event.data.type !== "rhwp-response") return;
            if (event.data.error) {
              if (status) status.textContent = "원문 뷰어 오류: " + event.data.error;
              return;
            }
            if (event.data.result && event.data.result.pageCount && status) {
              status.textContent = event.data.result.pageCount + "쪽 원문 렌더링";
            }
          });
          if (frame) frame.addEventListener("load", function () {
            if (status) status.textContent = "원문 파일을 뷰어에 전달하는 중입니다.";
            window.setTimeout(sendDocument, 300);
            window.setTimeout(sendDocument, 900);
            window.setTimeout(sendDocument, 1600);
          });
        })();
      </script>`;
}

function randomId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
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
