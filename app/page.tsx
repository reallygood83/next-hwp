"use client";

import {
  AlertTriangle,
  Download,
  Copy,
  FileAudio,
  FileText,
  FileType,
  Loader2,
  Mic,
  Package,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { buildBriefingHtml } from "@/lib/html-export";
import { extractTextFromFile } from "@/lib/hwpx";
import type {
  BriefingDuration,
  BriefingLanguage,
  BriefingResponse,
  BriefingResult,
  BriefingStyle,
  SpeechProvider,
} from "@/lib/types";

type WorkState = "idle" | "extracting" | "briefing" | "done" | "error";

const sampleText =
  "이 문서는 한글 문서를 빠르게 이해하기 위한 AI 음성 브리핑 기능 제안서입니다. 사용자는 HWP 또는 HWPX 문서를 열고 핵심 요약, 브리핑 대본, HTML 공유 파일, MP3 음성 파일을 생성할 수 있습니다. Gemini API는 구조화된 요약을 만들고 ElevenLabs API는 자연스러운 한국어 음성을 생성합니다. API 키는 안전하게 관리해야 하며 문서 내용이 외부 API로 전송된다는 점을 명확히 고지해야 합니다.";

const sampleHtml = textToPreviewHtml(sampleText);

const geminiTtsModels = [
  { value: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS Preview" },
  { value: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash TTS Preview" },
  { value: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro TTS Preview" },
];

const geminiVoices = [
  "Kore",
  "Puck",
  "Charon",
  "Fenrir",
  "Aoede",
  "Leda",
  "Orus",
  "Zephyr",
];

const elevenLabsModels = ["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_turbo_v2_5"];

const briefingLanguages: Array<{ value: BriefingLanguage; label: string }> = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

export default function Home() {
  const [filename, setFilename] = useState("sample.txt");
  const [text, setText] = useState(sampleText);
  const [documentHtml, setDocumentHtml] = useState(sampleHtml);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [documentKind, setDocumentKind] = useState<"hwp" | "hwpx" | "text">("text");
  const [documentStatus, setDocumentStatus] = useState<"ready" | "unsupported" | "empty">(
    "ready",
  );
  const [duration, setDuration] = useState<BriefingDuration>("standard");
  const [style, setStyle] = useState<BriefingStyle>("work");
  const [briefingLanguage, setBriefingLanguage] = useState<BriefingLanguage>("ko");
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>("gemini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiTtsModel, setGeminiTtsModel] = useState("gemini-3.1-flash-tts-preview");
  const [geminiVoiceName, setGeminiVoiceName] = useState("Kore");
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");
  const [elevenLabsModelId, setElevenLabsModelId] = useState("eleven_multilingual_v2");
  const [state, setState] = useState<WorkState>("idle");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [audio, setAudio] = useState<BriefingResponse["audio"]>();
  const [shareUrl, setShareUrl] = useState("");

  const audioUrl = useMemo(() => {
    if (!audio) return "";
    return `data:${audio.mimeType};base64,${audio.base64}`;
  }, [audio]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setState("extracting");
    setError("");
    setWarnings([]);
    setFilename(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractTextFromFile(file);
      const lowerName = file.name.toLowerCase();
      setText(extracted.text);
      setDocumentHtml(extracted.html || textToPreviewHtml(extracted.text));
      setDocumentBuffer(buffer);
      setDocumentKind(
        lowerName.endsWith(".hwp") ? "hwp" : lowerName.endsWith(".hwpx") ? "hwpx" : "text",
      );
      setDocumentStatus(extracted.status || (extracted.text.trim() ? "ready" : "empty"));
      setWarnings(extracted.warnings);
      setState("idle");
    } catch {
      setError("파일에서 텍스트를 추출하지 못했습니다.");
      setState("error");
    }
  }

  async function applyEditedHwp(bytes: Uint8Array) {
    const editedName = safeBaseName(filename) + "-edited.hwp";
    const buffer = toArrayBuffer(bytes);
    const file = new File([buffer], editedName, { type: "application/x-hwp" });
    const extracted = await extractTextFromFile(file);
    setFilename(editedName);
    setText(extracted.text);
    setDocumentHtml(extracted.html || textToPreviewHtml(extracted.text));
    setDocumentBuffer(buffer);
    setDocumentKind("hwp");
    setDocumentStatus(extracted.status || (extracted.text.trim() ? "ready" : "empty"));
    setWarnings(extracted.warnings);
    setResult(null);
    setAudio(undefined);
    setShareUrl("");
  }

  function downloadEditedHwp(bytes: Uint8Array) {
    downloadBlob(
      `${safeBaseName(filename)}-edited.hwp`,
      new Blob([toArrayBuffer(bytes)], { type: "application/x-hwp" }),
    );
  }

  async function createBriefing() {
    setState("briefing");
    setError("");
    setResult(null);
    setAudio(undefined);
    setShareUrl("");

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          text,
          duration,
          style,
          briefingLanguage,
          speechProvider,
          geminiApiKey: geminiApiKey.trim() || undefined,
          geminiTtsModel,
          geminiVoiceName,
          elevenLabsApiKey: elevenLabsApiKey.trim() || undefined,
          elevenLabsVoiceId: elevenLabsVoiceId.trim() || undefined,
          elevenLabsModelId,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "브리핑 생성에 실패했습니다.");
      }

      const body = (await response.json()) as BriefingResponse;
      setResult(body.briefing);
      setAudio(body.audio);
      setWarnings((previous) => [...previous, ...body.warnings]);
      setState("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "브리핑 생성에 실패했습니다.");
      setState("error");
    }
  }

  function downloadTextFile(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadAudio() {
    if (!audioUrl || !audio) return;
    const anchor = document.createElement("a");
    anchor.href = audioUrl;
    anchor.download = safeBaseName(filename) + "-briefing." + audioExtension(audio.mimeType);
    anchor.click();
  }

  function downloadHtml() {
    if (!result) return;
    downloadTextFile(
      safeBaseName(filename) + "-briefing.html",
      buildBriefingHtml(result, {
        audioFilename: safeBaseName(filename) + "-briefing." + audioExtension(audio?.mimeType),
        sourceHtml: documentHtml,
      }),
      "text/html;charset=utf-8",
    );
  }

  function downloadEmbeddedHtml() {
    if (!result) return;
    downloadTextFile(
      safeBaseName(filename) + "-briefing-embedded.html",
      buildBriefingHtml(result, {
        audioFilename: safeBaseName(filename) + "-briefing." + audioExtension(audio?.mimeType),
        embeddedAudio: audio,
        sourceHtml: documentHtml,
      }),
      "text/html;charset=utf-8",
    );
  }

  function makeEmbeddedHtml() {
    if (!result) return "";
    return buildBriefingHtml(result, {
      audioFilename: safeBaseName(filename) + "-briefing." + audioExtension(audio?.mimeType),
      embeddedAudio: audio,
      sourceHtml: documentHtml,
    });
  }

  async function createShareLink() {
    const html = makeEmbeddedHtml();
    if (!html) return;

    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });

    if (!response.ok) {
      setError("공유 페이지를 만들지 못했습니다.");
      return;
    }

    const body = (await response.json()) as { path: string };
    setShareUrl(new URL(body.path, window.location.origin).toString());
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
  }

  async function downloadPackage() {
    if (!result) return;
    const baseName = safeBaseName(filename);
    const html = buildBriefingHtml(result, {
      audioFilename: `${baseName}-briefing.${audioExtension(audio?.mimeType)}`,
      sourceHtml: documentHtml,
    });
    const zip = new JSZip();
    zip.file(`${baseName}-briefing.html`, html);
    if (audio) {
      zip.file(`${baseName}-briefing.${audioExtension(audio.mimeType)}`, audio.base64, {
        base64: true,
      });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`${baseName}-briefing-package.zip`, blob);
  }

  const isBusy = state === "extracting" || state === "briefing";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Mic size={18} aria-hidden="true" />
          </span>
          <span>Next HWP Briefing</span>
        </div>
        <span className="status-pill">
          <Sparkles size={15} aria-hidden="true" />
          Gemini TTS 기본
        </span>
      </header>

      <div className="workspace">
        <section className="panel controls" aria-label="브리핑 설정">
          <div>
            <p className="section-title">문서</p>
            <div className="dropzone">
              <Upload size={22} aria-hidden="true" />
              <input
                className="file-input"
                type="file"
                accept=".hwpx,.hwp,.txt,.md"
                onChange={(event) => void handleFile(event.currentTarget.files?.[0] || null)}
              />
              <p className="hint">
                HWP/HWPX는 rhwp WASM 뷰어로 원문을 표시하고, 브리핑용 본문도 함께
                추출합니다.
              </p>
            </div>
          </div>

          <div>
            <p className="section-title">추출 텍스트</p>
            <textarea
              className="textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="문서 본문을 붙여넣거나 HWPX 파일을 업로드하세요."
            />
          </div>

          <div className="grid-two">
            <div className="field">
              <label htmlFor="duration">길이</label>
              <select
                id="duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value as BriefingDuration)}
              >
                <option value="short">1분</option>
                <option value="standard">3분</option>
                <option value="deep">5분</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="style">스타일</label>
              <select
                id="style"
                value={style}
                onChange={(event) => setStyle(event.target.value as BriefingStyle)}
              >
                <option value="work">업무보고</option>
                <option value="study">학습용</option>
                <option value="news">뉴스형</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="briefingLanguage">브리핑 언어</label>
            <select
              id="briefingLanguage"
              value={briefingLanguage}
              onChange={(event) => setBriefingLanguage(event.target.value as BriefingLanguage)}
            >
              {briefingLanguages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="speechProvider">음성 엔진</label>
            <select
              id="speechProvider"
              value={speechProvider}
              onChange={(event) => setSpeechProvider(event.target.value as SpeechProvider)}
            >
              <option value="gemini">Gemini TTS 기본</option>
              <option value="elevenlabs">ElevenLabs 직접 입력</option>
            </select>
          </div>

          {speechProvider === "gemini" ? (
            <div className="voice-box">
              <div className="field">
                <label htmlFor="geminiApiKey">Gemini API key</label>
                <input
                  id="geminiApiKey"
                  type="password"
                  autoComplete="off"
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                  placeholder="비워두면 서버 환경변수 GEMINI_API_KEY를 사용합니다."
                />
              </div>
              <div className="field">
                <label htmlFor="geminiTtsModel">TTS 모델</label>
                <select
                  id="geminiTtsModel"
                  value={geminiTtsModel}
                  onChange={(event) => setGeminiTtsModel(event.target.value)}
                >
                  {geminiTtsModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="geminiVoiceName">Gemini 음성</label>
                <select
                  id="geminiVoiceName"
                  value={geminiVoiceName}
                  onChange={(event) => setGeminiVoiceName(event.target.value)}
                >
                  {geminiVoices.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
              </div>
              <p className="security-note">
                API key는 저장하지 않고 이번 요청에만 서버로 전송합니다. 공유 HTML, ZIP,
                링크에는 포함하지 않습니다.
              </p>
            </div>
          ) : (
            <div className="voice-box">
              <div className="field">
                <label htmlFor="elevenLabsApiKey">ElevenLabs API key</label>
                <input
                  id="elevenLabsApiKey"
                  type="password"
                  autoComplete="off"
                  value={elevenLabsApiKey}
                  onChange={(event) => setElevenLabsApiKey(event.target.value)}
                  placeholder="비워두면 서버 환경변수 ELEVENLABS_API_KEY를 사용합니다."
                />
              </div>
              <div className="field">
                <label htmlFor="elevenLabsVoiceId">ElevenLabs Voice ID</label>
                <input
                  id="elevenLabsVoiceId"
                  value={elevenLabsVoiceId}
                  onChange={(event) => setElevenLabsVoiceId(event.target.value)}
                  placeholder="예: JBFqnCBsd6RMkjVDRZzb"
                />
              </div>
              <div className="field">
                <label htmlFor="elevenLabsModelId">ElevenLabs 모델</label>
                <select
                  id="elevenLabsModelId"
                  value={elevenLabsModelId}
                  onChange={(event) => setElevenLabsModelId(event.target.value)}
                >
                  {elevenLabsModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <p className="security-note">
                ElevenLabs 키와 Voice ID는 서버에 저장하지 않고 음성 생성 요청에만 사용합니다.
              </p>
            </div>
          )}

          {warnings.map((warning) => (
            <div className="error" key={warning}>
              <AlertTriangle size={15} aria-hidden="true" /> {warning}
            </div>
          ))}
          {error ? <div className="error">{error}</div> : null}

          <div className="actions">
            <button
              className="primary"
              disabled={isBusy || text.trim().length < 20}
              onClick={() => void createBriefing()}
            >
              {isBusy ? <Loader2 size={17} aria-hidden="true" /> : <FileAudio size={17} />}
              {state === "extracting"
                ? "추출 중"
                : state === "briefing"
                  ? "생성 중"
                  : "AI 브리핑 만들기"}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setText(sampleText);
                setDocumentHtml(sampleHtml);
                setDocumentBuffer(null);
                setDocumentKind("text");
                setDocumentStatus("ready");
                setFilename("sample.txt");
              }}
            >
              <FileText size={17} />
              샘플
            </button>
          </div>
        </section>

        <section className="panel result" aria-label="브리핑 결과">
          {!result ? (
            <DocumentPreview
              filename={filename}
              html={documentHtml}
              buffer={documentBuffer}
              kind={documentKind}
              onApplyEditedHwp={(bytes) => void applyEditedHwp(bytes)}
              onDownloadEditedHwp={downloadEditedHwp}
              text={text}
              status={documentStatus}
            />
          ) : (
            <div className="result-grid">
              <article>
                <h1 className="brief-title">{result.title}</h1>
                <p className="summary">{result.oneLineSummary}</p>
                <h2>핵심 포인트</h2>
                <ul className="bullets">
                  {result.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <h2>브리핑 대본</h2>
                <div className="script">{result.briefingScript}</div>
                <h2>원문 보기</h2>
                <DocumentPreview
                  filename={filename}
                  html={documentHtml}
                  buffer={documentBuffer}
                  kind={documentKind}
                  text={text}
                  status={documentStatus}
                  compact
                />
              </article>

              <aside className="side-card">
                <p className="section-title">오디오</p>
                {audioUrl ? (
                  <audio controls src={audioUrl} />
                ) : (
                  <p className="hint">
                    선택한 음성 엔진의 API key가 없거나 음성 생성에 실패해 대본만 생성되었습니다.
                  </p>
                )}
                <button className="secondary" disabled={!audioUrl} onClick={downloadAudio}>
                  <Download size={17} />
                  오디오 저장
                </button>
                <button className="secondary" onClick={downloadHtml}>
                  <Package size={17} />
                  HTML 저장
                </button>
                <button className="secondary" disabled={!audio} onClick={downloadEmbeddedHtml}>
                  <FileType size={17} />
                  음성 포함 HTML
                </button>
                <button className="secondary" onClick={() => void downloadPackage()}>
                  <Package size={17} />
                  HTML+MP3 zip
                </button>
                <button className="secondary" onClick={() => void createShareLink()}>
                  <Share2 size={17} />
                  링크 생성
                </button>
                {shareUrl ? (
                  <div className="share-box">
                    <a href={shareUrl} target="_blank" rel="noreferrer">
                      {shareUrl}
                    </a>
                    <p>
                      로컬 실행에서는 이 컴퓨터의 서버가 켜져 있을 때만 접근됩니다. 공개 배포는
                      영속 저장소를 연결하세요.
                    </p>
                    <button className="secondary" onClick={() => void copyShareLink()}>
                      <Copy size={16} />
                      복사
                    </button>
                  </div>
                ) : null}
              </aside>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DocumentPreview({
  filename,
  html,
  buffer,
  kind = "text",
  onApplyEditedHwp,
  onDownloadEditedHwp,
  text,
  status,
  compact = false,
}: {
  filename: string;
  html: string;
  buffer?: ArrayBuffer | null;
  kind?: "hwp" | "hwpx" | "text";
  onApplyEditedHwp?: (bytes: Uint8Array) => void;
  onDownloadEditedHwp?: (bytes: Uint8Array) => void;
  text: string;
  status: "ready" | "unsupported" | "empty";
  compact?: boolean;
}) {
  const bodyHtml = html || textToPreviewHtml(text);
  const isUnsupported = status === "unsupported";
  const isEmpty = status === "empty" || (!bodyHtml && !isUnsupported);

  return (
    <div className={compact ? "doc-preview compact" : "doc-preview"}>
      <div className="doc-preview-toolbar">
        <span>
          <FileText size={16} aria-hidden="true" />
          {filename}
        </span>
        <span>
          {isUnsupported
            ? "표시 불가"
            : `${text.trim().length.toLocaleString()}자`}
        </span>
      </div>
      {buffer && (kind === "hwp" || kind === "hwpx") && !compact ? (
        <RhwpStudioViewer
          buffer={buffer}
          filename={filename}
          onApplyEditedHwp={onApplyEditedHwp}
          onDownloadEditedHwp={onDownloadEditedHwp}
        />
      ) : (
        <div className={isUnsupported ? "doc-page unsupported" : "doc-page"}>
          {isUnsupported ? (
            <div className="doc-empty unsupported-state">
              <AlertTriangle size={38} aria-hidden="true" />
              <h1>이 파일은 바로 표시하지 못했습니다</h1>
              <p>
                HWP 텍스트 추출을 시도했지만 표시 가능한 본문을 찾지 못했습니다. 암호화,
                배포용 문서, 일부 구형/복합 문서는 별도 변환기가 필요할 수 있습니다.
              </p>
              <div className="unsupported-actions">
                <span>가능한 진행</span>
                <ul>
                  <li>한글에서 HWPX로 저장한 뒤 업로드</li>
                  <li>본문을 왼쪽 텍스트 영역에 붙여넣기</li>
                  <li>rhwp/WASM 또는 서버-side 변환기 연결</li>
                </ul>
              </div>
            </div>
          ) : bodyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : isEmpty ? (
            <div className="doc-empty">
              <FileAudio size={34} aria-hidden="true" />
              <h1>문서 본문을 기다리고 있습니다</h1>
              <p>HWPX 파일을 올리거나 본문을 붙여넣으면 문서 보기와 브리핑을 함께 만듭니다.</p>
            </div>
          ) : null}
        </div>
      )}
      {isUnsupported ? (
        <p className="viewer-note">
          표시 가능한 원문이 없으면 왼쪽 텍스트 영역에 본문을 붙여넣어 브리핑을 만들 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}

function RhwpStudioViewer({
  buffer,
  filename,
  onApplyEditedHwp,
  onDownloadEditedHwp,
}: {
  buffer: ArrayBuffer;
  filename: string;
  onApplyEditedHwp?: (bytes: Uint8Array) => void;
  onDownloadEditedHwp?: (bytes: Uint8Array) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [message, setMessage] = useState("rhwp 뷰어 로딩 중");
  const exportModeRef = useRef<"apply" | "download" | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const send = () => {
      if (cancelled || !frameRef.current?.contentWindow) return;
      attempts += 1;
      frameRef.current.contentWindow.postMessage(
        {
          type: "hwpctl-load",
          fileName: filename,
          data: buffer.slice(0),
        },
        window.location.origin,
      );
      if (attempts < 8) {
        window.setTimeout(send, 450);
      }
    };

    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        result?: { pageCount?: number } | number[];
        error?: string;
      };
      if (data?.type !== "rhwp-response") return;
      if (data.error) {
        setMessage(`rhwp 뷰어 오류: ${data.error}`);
      } else if (Array.isArray(data.result)) {
        const bytes = new Uint8Array(data.result);
        const mode = exportModeRef.current;
        exportModeRef.current = null;
        if (mode === "download") {
          onDownloadEditedHwp?.(bytes);
          setMessage("편집본 HWP를 저장했습니다");
        } else {
          onApplyEditedHwp?.(bytes);
          setMessage("편집본을 브리핑 입력에 반영했습니다");
        }
      } else {
        const result = data.result as { pageCount?: number } | undefined;
        setMessage(`${result?.pageCount || 1}쪽 원문 렌더링`);
        cancelled = true;
      }
    };

    window.addEventListener("message", receive);
    const timer = window.setTimeout(send, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
  }, [buffer, filename, onApplyEditedHwp, onDownloadEditedHwp]);

  function requestExport(mode: "apply" | "download") {
    exportModeRef.current = mode;
    setMessage(mode === "apply" ? "편집본을 브리핑 입력으로 가져오는 중" : "편집본 HWP 저장 준비 중");
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "rhwp-request",
        id: `export-${mode}-${Date.now()}`,
        method: "exportHwp",
        params: {},
      },
      window.location.origin,
    );
  }

  return (
    <div className="rhwp-viewer">
      <div className="rhwp-viewer-status">
        <span>{message}</span>
        <div className="rhwp-viewer-actions">
          <button type="button" onClick={() => requestExport("apply")}>
            편집본 브리핑에 반영
          </button>
          <button type="button" onClick={() => requestExport("download")}>
            편집본 HWP 저장
          </button>
        </div>
      </div>
      <iframe
        ref={frameRef}
        title={`${filename} 원문 뷰어`}
        src="/rhwp-studio/index.html"
        className="rhwp-frame"
        onLoad={() => setMessage("문서를 rhwp 뷰어로 전달 중")}
      />
    </div>
  );
}

function safeBaseName(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function audioExtension(mimeType?: string) {
  if (!mimeType) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "audio";
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function textToPreviewHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
