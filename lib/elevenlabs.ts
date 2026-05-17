export async function synthesizeSpeech(text: string, voiceId?: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!selectedVoiceId) {
    return undefined;
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      selectedVoiceId,
    )}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 4800),
        model_id: modelId,
        language_code: "ko",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mimeType: response.headers.get("content-type") || "audio/mpeg",
    base64: buffer.toString("base64"),
  };
}
