import { getShareById, storageMediaUrl } from "@/lib/firebase-rest";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await getShareById(id);
  if (!share?.isPublic || !share.originalPreviewPath) {
    return new Response("Original preview not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const previewResponse = await fetch(storageMediaUrl(share.originalPreviewPath));
  if (!previewResponse.ok) {
    return new Response("Original preview file not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const html = await previewResponse.text();
  return new Response(html, {
    headers: {
      "Content-Type": share.originalPreviewMimeType || "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=0, no-store",
      "Content-Security-Policy":
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
