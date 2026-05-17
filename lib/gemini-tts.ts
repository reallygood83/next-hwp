import { GoogleGenAI, Modality } from "@google/genai";

export const DEFAULT_GEMINI_TTS_MODEL =
  process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
export const DEFAULT_GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";

type GeminiSpeechOptions = {
  apiKey?: string;
  model?: string;
  voiceName?: string;
};

export async function synthesizeGeminiSpeech(
  text: string,
  options: GeminiSpeechOptions = {},
) {
  const apiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: options.model || DEFAULT_GEMINI_TTS_MODEL,
    contents: [{ parts: [{ text: text.slice(0, 8000) }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: options.voiceName || DEFAULT_GEMINI_TTS_VOICE,
          },
        },
      },
    },
  });

  const inlineData = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)
    ?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini TTS did not return audio.");
  }

  const mimeType = inlineData.mimeType || "";
  if (mimeType.includes("wav") || mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return {
      mimeType,
      base64: inlineData.data,
    };
  }

  return {
    mimeType: "audio/wav",
    base64: wrapPcmAsWav(inlineData.data),
  };
}

function wrapPcmAsWav(
  pcmBase64: string,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}
