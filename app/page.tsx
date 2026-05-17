"use client";

import {
  AlertTriangle,
  Download,
  FileAudio,
  FileText,
  Loader2,
  Mic,
  Package,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { buildBriefingHtml } from "@/lib/html-export";
import { extractTextFromFile } from "@/lib/hwpx";
import type {
  BriefingDuration,
  BriefingResponse,
  BriefingResult,
  BriefingStyle,
} from "@/lib/types";

type WorkState = "idle" | "extracting" | "briefing" | "done" | "error";

const sampleText =
  "이 문서는 한글 문서를 빠르게 이해하기 위한 AI 음성 브리핑 기능 제안서입니다. 사용자는 HWP 또는 HWPX 문서를 열고 핵심 요약, 브리핑 대본, HTML 공유 파일, MP3 음성 파일을 생성할 수 있습니다. Gemini API는 구조화된 요약을 만들고 ElevenLabs API는 자연스러운 한국어 음성을 생성합니다. API 키는 안전하게 관리해야 하며 문서 내용이 외부 API로 전송된다는 점을 명확히 고지해야 합니다.";

export default function Home() {
  const [filename, setFilename] = useState("sample.txt");
  const [text, setText] = useState(sampleText);
  const [duration, setDuration] = useState<BriefingDuration>("standard");
  const [style, setStyle] = useState<BriefingStyle>("work");
  const [voiceId, setVoiceId] = useState("");
  const [state, setState] = useState<WorkState>("idle");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [audio, setAudio] = useState<BriefingResponse["audio"]>();

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
      const extracted = await extractTextFromFile(file);
      setText(extracted.text);
      setWarnings(extracted.warnings);
      setState("idle");
    } catch {
      setError("파일에서 텍스트를 추출하지 못했습니다.");
      setState("error");
    }
  }

  async function createBriefing() {
    setState("briefing");
    setError("");
    setResult(null);
    setAudio(undefined);

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          text,
          duration,
          style,
          voiceId: voiceId.trim() || undefined,
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
    if (!audioUrl) return;
    const anchor = document.createElement("a");
    anchor.href = audioUrl;
    anchor.download = safeBaseName(filename) + "-briefing.mp3";
    anchor.click();
  }

  function downloadHtml() {
    if (!result) return;
    downloadTextFile(
      safeBaseName(filename) + "-briefing.html",
      buildBriefingHtml(result, safeBaseName(filename) + "-briefing.mp3"),
      "text/html;charset=utf-8",
    );
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
          Gemini + ElevenLabs
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
                HWPX/TXT/MD는 바로 추출합니다. HWP binary는 추출 bridge가 필요해
                현재는 텍스트 붙여넣기로 진행합니다.
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
            <label htmlFor="voice">ElevenLabs Voice ID</label>
            <input
              id="voice"
              value={voiceId}
              onChange={(event) => setVoiceId(event.target.value)}
              placeholder="비워두면 서버 환경변수를 사용합니다."
            />
          </div>

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
            <button className="secondary" onClick={() => setText(sampleText)}>
              <FileText size={17} />
              샘플
            </button>
          </div>
        </section>

        <section className="panel result" aria-label="브리핑 결과">
          {!result ? (
            <div className="empty">
              <div className="empty-inner">
                <FileAudio size={44} aria-hidden="true" />
                <h1>문서를 들을 수 있는 브리핑으로 변환</h1>
                <p>
                  HWPX 파일을 올리거나 본문을 붙여넣으면 요약, 음성 대본, 공유용 HTML,
                  MP3 음성 파일을 한 번에 생성합니다.
                </p>
              </div>
            </div>
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
              </article>

              <aside className="side-card">
                <p className="section-title">오디오</p>
                {audioUrl ? (
                  <audio controls src={audioUrl} />
                ) : (
                  <p className="hint">
                    ElevenLabs API key가 없거나 음성 생성에 실패해 대본만 생성되었습니다.
                  </p>
                )}
                <button className="secondary" disabled={!audioUrl} onClick={downloadAudio}>
                  <Download size={17} />
                  MP3 저장
                </button>
                <button className="secondary" onClick={downloadHtml}>
                  <Package size={17} />
                  HTML 저장
                </button>
              </aside>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function safeBaseName(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
