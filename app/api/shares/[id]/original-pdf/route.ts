import { getShareById, storageMediaUrl } from "@/lib/firebase-rest";
import { contentDisposition } from "@/lib/content-disposition";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await getShareById(id);
  if (!share?.isPublic || !share.originalPdfPath) {
    return new Response("Original PDF not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pdfResponse = await fetch(storageMediaUrl(share.originalPdfPath));
  if (!pdfResponse.ok) {
    return new Response("Original PDF file not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  const pdf = await pdfResponse.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": share.originalPdfMimeType || "application/pdf",
      "Content-Disposition": contentDisposition(disposition, `${safeDownloadName(share.title)}-original.pdf`),
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeDownloadName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "hwpvoice-briefing"
  );
}
