export type BriefingDuration = "short" | "standard" | "deep";

export type BriefingStyle = "work" | "study" | "news";

export type SpeechProvider = "gemini" | "elevenlabs";

export type BriefingRequest = {
  filename: string;
  text: string;
  duration: BriefingDuration;
  style: BriefingStyle;
  speechProvider?: SpeechProvider;
  geminiApiKey?: string;
  geminiTtsModel?: string;
  geminiVoiceName?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;
};

export type BriefingResult = {
  title: string;
  oneLineSummary: string;
  keyPoints: string[];
  briefingScript: string;
  htmlBody: string;
  caveats: string[];
};

export type BriefingResponse = {
  briefing: BriefingResult;
  audio?: {
    mimeType: string;
    base64: string;
  };
  warnings: string[];
};

export type ExtractionResult = {
  text: string;
  html: string;
  status?: "ready" | "unsupported" | "empty";
  warnings: string[];
};
