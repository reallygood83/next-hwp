import { GoogleGenAI, Type } from "@google/genai";
import type { BriefingRequest, BriefingResult } from "./types";

const fallbackResult = (request: BriefingRequest): BriefingResult => {
  const compactText = request.text.replace(/\s+/g, " ").slice(0, 900);
  return {
    title: `${request.filename} 브리핑`,
    oneLineSummary:
      "Gemini API key가 없어 로컬 fallback 요약을 생성했습니다. 실제 브리핑 품질은 API key 설정 후 확인하세요.",
    keyPoints: [
      "문서 본문 추출은 완료되었습니다.",
      "Gemini API key를 설정하면 구조화 요약과 자연스러운 음성 대본을 생성합니다.",
      compactText || "추출된 본문이 비어 있습니다.",
    ],
    briefingScript: `안녕하세요. ${request.filename} 문서의 임시 브리핑입니다.\n\n${compactText}\n\n중요한 판단 전에는 원문을 다시 확인하세요.`,
    htmlBody: `<p>${compactText}</p>`,
    caveats: ["Fallback result generated without Gemini API."],
  };
};

type CreateBriefingOptions = {
  apiKey?: string;
};

export async function createBriefing(
  request: BriefingRequest,
  options: CreateBriefingOptions = {},
): Promise<BriefingResult> {
  const apiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackResult(request);
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(request);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          oneLineSummary: { type: Type.STRING },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          briefingScript: { type: Type.STRING },
          htmlBody: { type: Type.STRING },
          caveats: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "title",
          "oneLineSummary",
          "keyPoints",
          "briefingScript",
          "htmlBody",
          "caveats",
        ],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini did not return a JSON body.");
  }

  return normalizeBriefing(JSON.parse(text));
}

function buildPrompt(request: BriefingRequest) {
  const durationLabel =
    request.duration === "short"
      ? "about 1 minute"
      : request.duration === "deep"
        ? "about 5 minutes"
        : "about 3 minutes";
  const styleInstruction = briefingStyleInstruction(request.style);
  const languageLabel = languageName(request.briefingLanguage || "ko");

  return [
    "You create voice briefings from HWP/HWPX document text.",
    `Write every user-facing output in ${languageLabel}.`,
    "Do not invent facts that are not grounded in the source.",
    `Write the briefingScript as natural ${languageLabel} speech.`,
    "htmlBody must be a safe fragment using only p, h2, ul, li, strong tags.",
    `Filename: ${request.filename}`,
    `Target length: ${durationLabel}`,
    `Style instruction: ${styleInstruction}`,
    "Source text:",
    request.text.slice(0, 42000),
  ].join("\n\n");
}

function briefingStyleInstruction(style: BriefingRequest["style"]) {
  const instructions: Record<BriefingRequest["style"], string> = {
    work: "work briefing for an internal staff update; concise, factual, action-oriented",
    study: "study note for learners; explain terms clearly and include learning checkpoints",
    news: "news-style briefing; lead with what happened, why it matters, and what follows",
    "family-letter":
      "school family letter; warm, polite, parent-friendly, with dates, required actions, and contact guidance",
    "parent-notice":
      "parent notice; simple language, clear preparation items, deadlines, and student/parent actions",
    "civil-service":
      "civil complaint response; respectful, neutral, procedural, and careful not to overpromise",
    "executive-report":
      "executive report; summarize issue, evidence, decision points, risks, and recommended action",
    training:
      "training guide; explain purpose, schedule, participation method, and expected outcomes",
    meeting:
      "meeting briefing; agenda-first, discussion points, decisions needed, and follow-up tasks",
    easy: "plain-language briefing; short sentences, no jargon, explain administrative terms",
    multicultural:
      "multicultural family guidance; culturally sensitive, easy to understand, practical, and parent-friendly",
  };
  return instructions[style];
}

function languageName(language: NonNullable<BriefingRequest["briefingLanguage"]>) {
  const names: Record<string, string> = {
    ko: "Korean",
    en: "English",
    ja: "Japanese",
    zh: "Chinese",
    vi: "Vietnamese",
    ru: "Russian",
    mn: "Mongolian",
    th: "Thai",
    id: "Indonesian",
    tl: "Tagalog",
    km: "Khmer",
    my: "Burmese",
    lo: "Lao",
    ms: "Malay",
    hi: "Hindi",
    bn: "Bengali",
    ur: "Urdu",
    ne: "Nepali",
    ta: "Tamil",
    te: "Telugu",
    ar: "Arabic",
    fa: "Persian",
    tr: "Turkish",
    he: "Hebrew",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    pl: "Polish",
    uk: "Ukrainian",
    cs: "Czech",
    sk: "Slovak",
    hu: "Hungarian",
    ro: "Romanian",
    bg: "Bulgarian",
    el: "Greek",
    sv: "Swedish",
    da: "Danish",
    fi: "Finnish",
    no: "Norwegian",
  };
  return names[language] || language;
}

function normalizeBriefing(value: Partial<BriefingResult>): BriefingResult {
  return {
    title: String(value.title || "문서 브리핑"),
    oneLineSummary: String(value.oneLineSummary || ""),
    keyPoints: Array.isArray(value.keyPoints)
      ? value.keyPoints.map(String).slice(0, 8)
      : [],
    briefingScript: String(value.briefingScript || ""),
    htmlBody: String(value.htmlBody || ""),
    caveats: Array.isArray(value.caveats) ? value.caveats.map(String).slice(0, 6) : [],
  };
}
