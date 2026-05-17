"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  Copy,
  FileAudio,
  FileText,
  FileType,
  Loader2,
  Lock,
  Package,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import type { User } from "firebase/auth";
import { buildBriefingHtml } from "@/lib/html-export";
import {
  createFirebaseShare,
  getFirebaseAnalytics,
  listenToAuth,
  signInWithGoogle,
  signOutUser,
} from "@/lib/firebase";
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
const githubUrl = "https://github.com/reallygood83/next-hwp";
const youtubeUrl = "https://www.youtube.com/@%EB%B0%B0%EC%9B%80%EC%9D%98%EB%8B%AC%EC%9D%B8-p5v";

const geminiTtsModels = [
  { value: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash TTS Preview" },
  { value: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro TTS Preview" },
  { value: "gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS Preview" },
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
  { value: "vi", label: "Tiếng Việt" },
  { value: "ru", label: "Русский" },
  { value: "mn", label: "Монгол" },
  { value: "th", label: "ไทย" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "tl", label: "Filipino / Tagalog" },
  { value: "km", label: "ភាសាខ្មែរ" },
  { value: "my", label: "မြန်မာ" },
  { value: "lo", label: "ລາວ" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "hi", label: "हिन्दी" },
  { value: "bn", label: "বাংলা" },
  { value: "ur", label: "اردو" },
  { value: "ne", label: "नेपाली" },
  { value: "ta", label: "தமிழ்" },
  { value: "te", label: "తెలుగు" },
  { value: "ar", label: "العربية" },
  { value: "fa", label: "فارسی" },
  { value: "tr", label: "Türkçe" },
  { value: "he", label: "עברית" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "nl", label: "Nederlands" },
  { value: "pl", label: "Polski" },
  { value: "uk", label: "Українська" },
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenčina" },
  { value: "hu", label: "Magyar" },
  { value: "ro", label: "Română" },
  { value: "bg", label: "Български" },
  { value: "el", label: "Ελληνικά" },
  { value: "sv", label: "Svenska" },
  { value: "da", label: "Dansk" },
  { value: "fi", label: "Suomi" },
  { value: "no", label: "Norsk" },
];

function LandingPage({
  authReady,
  authError,
  onSignIn,
}: {
  authReady: boolean;
  authError: string;
  onSignIn: () => void;
}) {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">
            <FileAudio size={18} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <span className="brand-title">한글소리 AI</span>
            <span className="brand-subtitle">HwpVoice</span>
          </span>
        </Link>
        <div className="nav-actions">
          <a className="secondary compact-button nav-link" href={githubUrl} target="_blank" rel="noreferrer">
            <Download size={16} />
            다운로드
          </a>
          <button className="secondary compact-button" disabled={!authReady} onClick={onSignIn}>
            <Lock size={16} />
            Google로 시작
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">교사와 공공 실무자를 위한 한글 문서 브리핑</p>
          <h1>한글 문서를 편집하고, 음성 브리핑 HTML로 배포합니다.</h1>
          <p>
            HWP/HWPX 원문을 브라우저에서 확인하고 필요한 수정을 마친 뒤 Gemini TTS
            또는 ElevenLabs로 짧은 음성 브리핑을 생성합니다. 공유용 HTML과 오디오 파일까지
            한 흐름에서 만들 수 있습니다.
          </p>
          <p>
            다문화 가정 학생과 학부모에게 전달해야 하는 안내문, 민원 답변, 연수 공지,
            학교생활 안내를 여러 언어의 음성 브리핑으로 바꿔 접근성을 높일 수 있습니다.
          </p>
          <div className="landing-actions">
            <button className="primary hero-button" disabled={!authReady} onClick={onSignIn}>
              <Lock size={18} />
              Google 로그인 후 사용
            </button>
            <span>개인 API key를 직접 입력해 사용합니다.</span>
          </div>
          {authError ? <div className="error">{authError}</div> : null}
        </div>
        <div className="landing-preview" aria-hidden="true">
          <Image
            src="/landing-briefing-hero_001.jpg"
            alt=""
            className="landing-preview-image"
            width={1280}
            height={720}
            priority
            sizes="(max-width: 900px) 100vw, 520px"
          />
          <div className="landing-preview-caption">
            <strong>HWP 문서 → AI 브리핑 → 공유 HTML</strong>
            <span>문서 검토, 음성 대본, 링크 배포를 한 화면에서 처리합니다.</span>
          </div>
        </div>
      </section>

      <section className="landing-grid" aria-label="활용 방식">
        <article>
          <h2>문서 작성부터</h2>
          <p>내장 rhwp 편집기로 한글 문서를 열고 수정한 뒤 편집본을 브리핑 입력에 반영합니다.</p>
        </article>
        <article>
          <h2>음성 브리핑까지</h2>
          <p>한국어, 영어, 일본어, 중국어 브리핑 언어를 선택하고 Gemini TTS를 기본으로 사용합니다.</p>
        </article>
        <article>
          <h2>공유와 배포</h2>
          <p>음성 포함 HTML, HTML+오디오 zip, 공유 링크를 생성해 회의 전 브리핑 자료로 배포합니다.</p>
        </article>
        <article>
          <h2>다문화 민원 안내</h2>
          <p>복잡한 한글 안내문을 학부모가 이해하기 쉬운 다국어 음성 콘텐츠로 바꿉니다.</p>
        </article>
      </section>

      <section className="trust-band">
        <h2>공공 문서 사용을 고려한 기본 원칙</h2>
        <p>
          원문 문서는 기본 저장하지 않고, API key는 요청 단위로만 사용합니다. 학생 개인정보,
          연락처, 주소가 포함된 문서는 비식별 후 외부 AI API로 전송하는 것이 안전합니다.
        </p>
      </section>

      <footer className="landing-footer">
        <span>2026 Copyright 배움의 달인</span>
        <a className="secondary compact-button nav-link" href={youtubeUrl} target="_blank" rel="noreferrer">
          배움의 달인 유튜브 바로가기
        </a>
      </footer>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
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
  const [geminiTtsModel, setGeminiTtsModel] = useState("gemini-2.5-flash-preview-tts");
  const [geminiVoiceName, setGeminiVoiceName] = useState("Kore");
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("");
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState("");
  const [elevenLabsModelId, setElevenLabsModelId] = useState("eleven_multilingual_v2");
  const [state, setState] = useState<WorkState>("idle");
  const [briefingProgress, setBriefingProgress] = useState(0);
  const [briefingProgressLabel, setBriefingProgressLabel] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [audio, setAudio] = useState<BriefingResponse["audio"]>();
  const [shareUrl, setShareUrl] = useState("");

  const audioUrl = useMemo(() => {
    if (!audio) return "";
    return `data:${audio.mimeType};base64,${audio.base64}`;
  }, [audio]);
  const isMissingSpeechCredential =
    speechProvider === "gemini"
      ? !geminiApiKey.trim()
      : !elevenLabsApiKey.trim() || !elevenLabsVoiceId.trim();

  useEffect(() => {
    void getFirebaseAnalytics();
    return listenToAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  async function handleSignIn() {
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Google 로그인에 실패했습니다.");
    }
  }

  async function handleSignOut() {
    await signOutUser();
    setResult(null);
    setAudio(undefined);
    setShareUrl("");
  }

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
    setBriefingProgress(8);
    setBriefingProgressLabel("문서 내용을 정리하고 있습니다.");
    setError("");
    setResult(null);
    setAudio(undefined);
    setShareUrl("");
    let progressTimer: number | undefined;

    try {
      progressTimer = window.setInterval(() => {
        setBriefingProgress((current) => {
          if (current < 32) {
            setBriefingProgressLabel("브리핑 대본을 생성하고 있습니다.");
            return current + 4;
          }
          if (current < 68) {
            setBriefingProgressLabel("선택한 언어로 핵심 내용을 구성하고 있습니다.");
            return current + 3;
          }
          if (current < 88) {
            setBriefingProgressLabel("음성 파일을 합성하고 있습니다.");
            return current + 2;
          }
          return current;
        });
      }, 700);

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
      window.clearInterval(progressTimer);
      progressTimer = undefined;
      setBriefingProgress(94);
      setBriefingProgressLabel("브리핑 결과를 정리하고 있습니다.");

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "브리핑 생성에 실패했습니다.");
      }

      const body = (await response.json()) as BriefingResponse;
      setResult(body.briefing);
      setAudio(body.audio);
      setWarnings((previous) => [...previous, ...body.warnings]);
      setBriefingProgress(100);
      setBriefingProgressLabel("브리핑 생성이 완료되었습니다.");
      setState("done");
    } catch (reason) {
      if (progressTimer) {
        window.clearInterval(progressTimer);
      }
      setBriefingProgress(0);
      setBriefingProgressLabel("");
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
        originalDocument: originalDocumentPayload(),
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
        originalDocument: originalDocumentPayload(),
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
      originalDocument: originalDocumentPayload(),
    });
  }

  async function createShareLink() {
    const html = makeEmbeddedHtml();
    if (!html) return;

    if (!user || !result) {
      setError("공유 페이지를 만들지 못했습니다.");
      return;
    }

    try {
      const shared = await createFirebaseShare({
        user,
        html,
        title: result.title,
        sourceFilename: filename,
        language: briefingLanguage,
        speechProvider,
      });
      setShareUrl(new URL(`/s/${shared.id}`, window.location.origin).toString());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `공유 페이지를 만들지 못했습니다: ${reason.message}`
          : "공유 페이지를 만들지 못했습니다.",
      );
    }
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
      originalDocument: originalDocumentPayload(),
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

  function originalDocumentPayload() {
    if (!documentBuffer || (documentKind !== "hwp" && documentKind !== "hwpx")) return undefined;
    return {
      filename,
      base64: arrayBufferToBase64(documentBuffer),
    };
  }

  const isBusy = state === "extracting" || state === "briefing";

  if (!user) {
    return (
      <LandingPage
        authReady={authReady}
        authError={authError}
        onSignIn={() => void handleSignIn()}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">
            <FileAudio size={18} aria-hidden="true" />
          </span>
          <span className="brand-text">
            <span className="brand-title">한글소리 AI</span>
            <span className="brand-subtitle">HwpVoice</span>
          </span>
        </Link>
        <div className="topbar-actions">
          <span className="status-pill">
            <Sparkles size={15} aria-hidden="true" />
            Gemini 2.5 TTS 기본
          </span>
          <a className="account-button nav-link" href={githubUrl} target="_blank" rel="noreferrer">
            <Download size={14} />
            다운로드
          </a>
          <button className="account-button" onClick={() => void handleSignOut()}>
            {user.displayName || user.email || "사용자"} 로그아웃
          </button>
        </div>
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
                <option value="family-letter">가정통신문</option>
                <option value="parent-notice">학부모 안내</option>
                <option value="civil-service">민원 답변</option>
                <option value="executive-report">보고용 요약</option>
                <option value="training">연수 안내</option>
                <option value="meeting">회의 브리핑</option>
                <option value="easy">쉬운 말 설명</option>
                <option value="multicultural">다문화 가정 안내</option>
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
                  placeholder="Gemini API key를 입력하세요."
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
                  placeholder="ElevenLabs API key를 입력하세요."
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
          {isMissingSpeechCredential ? (
            <div className="error">
              <AlertTriangle size={15} aria-hidden="true" />
              {speechProvider === "gemini"
                ? "Gemini API key를 입력해야 음성 브리핑을 만들 수 있습니다."
                : "ElevenLabs API key와 Voice ID를 입력해야 음성 브리핑을 만들 수 있습니다."}
            </div>
          ) : null}
          {state === "briefing" ? (
            <div className="progress-card" aria-live="polite">
              <div className="progress-meta">
                <span>{briefingProgressLabel}</span>
                <strong>{briefingProgress}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${briefingProgress}%` }} />
              </div>
            </div>
          ) : null}

          <div className="actions">
            <button
              className="primary"
              disabled={isBusy || text.trim().length < 20 || isMissingSpeechCredential}
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
                      Firebase Storage에 저장된 공유 페이지입니다. 공개 URL이므로 배포 전
                      개인정보 포함 여부를 확인하세요.
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

      <footer className="app-footer">
        <span>2026 Copyright 배움의 달인</span>
        <a className="secondary compact-button nav-link" href={youtubeUrl} target="_blank" rel="noreferrer">
          배움의 달인 유튜브 바로가기
        </a>
      </footer>
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
