import {
  deleteShareDocument,
  deleteStorageObject,
  getShareById,
  verifyFirebaseIdToken,
} from "@/lib/firebase-rest";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const idToken = readBearerToken(request);
    if (!idToken) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }

    const { id } = await context.params;
    if (!/^[a-f0-9]{20}$/i.test(id)) {
      return Response.json({ error: "Invalid share id." }, { status: 400 });
    }

    const user = await verifyFirebaseIdToken(idToken);
    const share = await getShareById(id);
    if (!share || share.ownerUid !== user.uid) {
      return Response.json({ error: "Share not found." }, { status: 404 });
    }

    if (share.audioPath) {
      await deleteStorageObject(idToken, share.audioPath);
    }
    if (share.originalPdfPath) {
      await deleteStorageObject(idToken, share.originalPdfPath);
    }
    await deleteShareDocument(idToken, id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to delete share." }, { status: 500 });
  }
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
