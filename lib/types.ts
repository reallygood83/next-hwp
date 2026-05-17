export type BriefingDuration = "short" | "standard" | "deep";

export type BriefingStyle = "work" | "study" | "news";

export type BriefingRequest = {
  filename: string;
  text: string;
  duration: BriefingDuration;
  style: BriefingStyle;
  voiceId?: string;
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
  warnings: string[];
};
