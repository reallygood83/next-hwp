import { createBriefing } from "@/lib/gemini";
import { synthesizeGeminiSpeech } from "@/lib/gemini-tts";
import { synthesizeElevenLabsSpeech } from "@/lib/elevenlabs";
import type { BriefingRequest, BriefingResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BriefingRequest;
    const validationError = validate(body);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const briefing = await createBriefing(body);
    const warnings: string[] = [];
    let audio: BriefingResponse["audio"];
    const provider = body.speechProvider || "gemini";

    try {
      if (provider === "elevenlabs") {
        audio = await synthesizeElevenLabsSpeech(briefing.briefingScript, {
          apiKey: body.elevenLabsApiKey,
          voiceId: body.elevenLabsVoiceId,
          modelId: body.elevenLabsModelId,
          languageCode: body.briefingLanguage || "ko",
        });
        if (!audio) {
          warnings.push("ElevenLabs API key or voice id is missing; audio was skipped.");
        }
      } else {
        audio = await synthesizeGeminiSpeech(briefing.briefingScript, {
          apiKey: body.geminiApiKey,
          model: body.geminiTtsModel,
          voiceName: body.geminiVoiceName,
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

    return Response.json(response);
  } catch {
    return Response.json(
      { error: "Failed to create briefing. Check server environment variables." },
      { status: 500 },
    );
  }
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
