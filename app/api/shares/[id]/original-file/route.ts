import { getShareById, storageMediaUrl } from "@/lib/firebase-rest";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const share = await getShareById(id);
  if (!share?.isPublic || !share.originalFilePath) {
    return new Response("Original file not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const fileResponse = await fetch(storageMediaUrl(share.originalFilePath));
  if (!fileResponse.ok) {
    return new Response("Original file storage object not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const file = await fileResponse.arrayBuffer();
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(file, {
    headers: {
      "Content-Type": share.originalFileMimeType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${safeDownloadName(share.sourceFilename || share.title)}"`,
      "Content-Length": String(file.byteLength),
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
      .slice(0, 120) || "hwpvoice-original.hwp"
  );
}
