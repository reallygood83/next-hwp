import { createBriefing } from "@/lib/gemini";
import { synthesizeSpeech } from "@/lib/elevenlabs";
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

    try {
      audio = await synthesizeSpeech(briefing.briefingScript, body.voiceId);
      if (!audio) {
        warnings.push("ElevenLabs API key or voice id is missing; audio was skipped.");
      }
    } catch {
      warnings.push("ElevenLabs synthesis failed; briefing text and HTML are still available.");
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
