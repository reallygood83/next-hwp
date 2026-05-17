import { createBriefing } from "@/lib/gemini";
import { synthesizeGeminiSpeech } from "@/lib/gemini-tts";
import { synthesizeElevenLabsSpeech } from "@/lib/elevenlabs";
import type { BriefingRequest, BriefingResponse } from "@/lib/types";

export const runtime = "nodejs";

type BriefingRequestCredentials = {
  geminiApiKey?: string;
  elevenLabsApiKey?: string;
};

type IncomingBriefingRequest = BriefingRequest & BriefingRequestCredentials;

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomingBriefingRequest;
    const {
      geminiApiKey: rawGeminiApiKey,
      elevenLabsApiKey: rawElevenLabsApiKey,
      ...briefingRequest
    } = body;
    const credentials = {
      geminiApiKey: rawGeminiApiKey?.trim(),
      elevenLabsApiKey: rawElevenLabsApiKey?.trim(),
    };

    const validationError = validate(briefingRequest);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400, headers: noStoreHeaders });
    }

    const warnings: string[] = [];
    let audio: BriefingResponse["audio"];
    const provider = briefingRequest.speechProvider || "gemini";
    const credentialError = validateSpeechCredentials(briefingRequest, credentials, provider);
    if (credentialError) {
      return Response.json({ error: credentialError }, { status: 400, headers: noStoreHeaders });
    }

    const briefing = await createBriefing(briefingRequest, {
      apiKey: credentials.geminiApiKey,
    });

    try {
      if (provider === "elevenlabs") {
        audio = await synthesizeElevenLabsSpeech(briefing.briefingScript, {
          apiKey: credentials.elevenLabsApiKey,
          voiceId: briefingRequest.elevenLabsVoiceId,
          modelId: briefingRequest.elevenLabsModelId,
          languageCode: briefingRequest.briefingLanguage || "ko",
        });
        if (!audio) {
          warnings.push("ElevenLabs API key or voice id is missing; audio was skipped.");
        }
      } else {
        audio = await synthesizeGeminiSpeech(briefing.briefingScript, {
          apiKey: credentials.geminiApiKey,
          model: briefingRequest.geminiTtsModel,
          voiceName: briefingRequest.geminiVoiceName,
        });
        if (!audio) {
          warnings.push("Gemini API key is missing; audio was skipped.");
        }
      }
    } catch {
      warnings.push(
        provider === "elevenlabs"
          ? "ElevenLabs synthesis failed; briefing text and HTML are still available."
          : "Gemini TTS failed; briefing text and HTML are still available.",
      );
    }

    const response: BriefingResponse = {
      briefing,
      audio,
      warnings,
    };

    return Response.json(response, { headers: noStoreHeaders });
  } catch {
    return Response.json(
      { error: "Failed to create briefing. Check server environment variables." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

function validateSpeechCredentials(
  body: BriefingRequest,
  credentials: BriefingRequestCredentials,
  provider: NonNullable<BriefingRequest["speechProvider"]>,
) {
  if (provider === "elevenlabs") {
    if (!credentials.elevenLabsApiKey || !body.elevenLabsVoiceId?.trim()) {
      return "ElevenLabs API key and Voice ID are required.";
    }
    return null;
  }
  if (!credentials.geminiApiKey) {
    return "Gemini API key is required.";
  }
  return null;
}

function validate(body: BriefingRequest) {
  if (!body || typeof body !== "object") {
    return "Invalid JSON payload.";
  }
  if (!body.filename || typeof body.filename !== "string") {
    return "filename is required.";
  }
  if (!body.text || typeof body.text !== "string" || body.text.trim().length < 20) {
    return "text must contain at least 20 characters.";
  }
  return null;
}
