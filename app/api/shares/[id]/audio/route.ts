import { getShareById, storageMediaUrl } from "@/lib/firebase-rest";
import { contentDisposition } from "@/lib/content-disposition";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await getShareById(id);
  if (!share?.isPublic || !share.audioPath) {
    return new Response("Audio not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const audioResponse = await fetch(storageMediaUrl(share.audioPath));
  if (!audioResponse.ok) {
    return new Response("Audio file not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(audioResponse.body, {
    headers: {
      "Content-Type": share.audioMimeType || "audio/mpeg",
      "Content-Disposition": contentDisposition(
        "attachment",
        `${safeDownloadName(share.title)}.${audioExtension(share.audioMimeType)}`,
      ),
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function audioExtension(mimeType: string) {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "audio";
}

function safeDownloadName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "hwpvoice-briefing"
  );
}
