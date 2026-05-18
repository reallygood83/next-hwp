import {
  countUserShares,
  createShareDocument,
  verifyFirebaseIdToken,
} from "@/lib/firebase-rest";
import { SHARE_SIZE_LIMIT_BYTES, SHARE_SIZE_LIMIT_MB } from "@/lib/share-limits";
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
      originalPreviewPath?: string;
      originalPreviewMimeType?: string;
      originalFilePath?: string;
      originalFileMimeType?: string;
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
      originalPreviewPath: body.originalPreviewPath || "",
      originalPreviewMimeType: body.originalPreviewMimeType || "",
      originalFilePath: body.originalFilePath || "",
      originalFileMimeType: body.originalFileMimeType || "",
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
    originalPreviewPath?: string;
    originalFilePath?: string;
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
  if (
    body.originalPreviewPath &&
    body.originalPreviewPath !== `briefings/${uid}/${body.id}/original-preview.html`
  ) {
    return "Invalid original preview path.";
  }
  if (body.originalFilePath && !body.originalFilePath.startsWith(`briefings/${uid}/${body.id}/original.`)) {
    return "Invalid original file path.";
  }
  if ((body.sizeBytes || 0) > SHARE_SIZE_LIMIT_BYTES) {
    return `공유 파일은 ${SHARE_SIZE_LIMIT_MB}MB 이하로 생성할 수 있습니다. 원문 PDF 또는 HWP 뷰어 공유 옵션을 끄고 다시 시도하세요.`;
  }
  return null;
}
