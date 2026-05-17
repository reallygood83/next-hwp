import { listUserShares, verifyFirebaseIdToken } from "@/lib/firebase-rest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const idToken = readBearerToken(request);
    if (!idToken) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }

    const user = await verifyFirebaseIdToken(idToken);
    const shares = await listUserShares(idToken, user.uid);
    return Response.json({
      shares: shares.map((share) => ({
        id: share.id,
        title: share.title,
        sourceFilename: share.sourceFilename,
        language: share.language,
        speechProvider: share.speechProvider,
        hasAudio: Boolean(share.audioPath),
        hasOriginalPdf: Boolean(share.originalPdfPath),
        hasOriginalPreview: Boolean(share.originalPreviewPath),
        hasOriginalFile: Boolean(share.originalFilePath),
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        sizeBytes: share.sizeBytes,
      })),
    });
  } catch {
    return Response.json({ error: "Failed to list shares." }, { status: 500 });
  }
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
