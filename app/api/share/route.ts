import {
  countUserShares,
  createShareDocument,
  verifyFirebaseIdToken,
} from "@/lib/firebase-rest";
import type { BriefingResult, SpeechProvider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const idToken = readBearerToken(request);
    if (!idToken) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }

    const user = await verifyFirebaseIdToken(idToken);
    const shareCount = await countUserShares(idToken, user.uid);
    if (shareCount >= 3) {
      return Response.json(
        { error: "공유 저장공간은 사용자당 3개까지입니다. 내 공유 문서에서 기존 항목을 삭제하세요." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      id?: string;
      briefing?: BriefingResult;
      sourceFilename?: string;
      language?: string;
      speechProvider?: SpeechProvider;
      audioPath?: string;
      audioMimeType?: string;
      originalPdfPath?: string;
      originalPdfMimeType?: string;
      sizeBytes?: number;
    };

    const error = validateShareBody(body, user.uid);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const share = await createShareDocument({
      idToken,
      user,
      id: body.id!,
      briefing: body.briefing!,
      sourceFilename: body.sourceFilename!,
      language: body.language || "ko",
      speechProvider: body.speechProvider || "gemini",
      audioPath: body.audioPath || "",
      audioMimeType: body.audioMimeType || "",
      originalPdfPath: body.originalPdfPath || "",
      originalPdfMimeType: body.originalPdfMimeType || "",
      sizeBytes: body.sizeBytes || 0,
    });

    return Response.json({ id: share.id });
  } catch {
    return Response.json({ error: "Failed to create share page." }, { status: 500 });
  }
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function validateShareBody(
  body: {
    id?: string;
    briefing?: BriefingResult;
    sourceFilename?: string;
    audioPath?: string;
    originalPdfPath?: string;
    sizeBytes?: number;
  },
  uid: string,
) {
  if (!body.id || !/^[a-f0-9]{20}$/i.test(body.id)) {
    return "Invalid share id.";
  }
  if (!body.briefing?.title || !body.briefing.briefingScript) {
    return "briefing is required.";
  }
  if (body.briefing.briefingScript.length > 12000 || (body.briefing.htmlBody || "").length > 16000) {
    return "briefing is too large to share.";
  }
  if (!body.sourceFilename || body.sourceFilename.length > 180) {
    return "sourceFilename is required.";
  }
  if (body.audioPath && !body.audioPath.startsWith(`briefings/${uid}/${body.id}/`)) {
    return "Invalid audio path.";
  }
  if (body.originalPdfPath && body.originalPdfPath !== `briefings/${uid}/${body.id}/original.pdf`) {
    return "Invalid original PDF path.";
  }
  if ((body.sizeBytes || 0) > 10 * 1024 * 1024) {
    return "Shared files must be under 10MB.";
  }
  return null;
}
